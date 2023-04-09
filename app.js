const CLIENT_ID = "d347cce711f34e3bbfe5f52689e46c09";
const CLIENT_SECRET = "5a459975172742f992d247bd1050e84e";
// const HOME_URL = "http://127.0.0.1:5500/index.html";
const HOME_URL = "https://itzterra.github.io/SpotifyTools/";

function goTop(){
    document.body.scrollIntoView()
}

const SCROLL_AMOUNT = 500
const scrollTopButton = document.getElementById("scrollButton")
window.onscroll = () => {
    if (document.body.scrollTop > SCROLL_AMOUNT || document.documentElement.scrollTop > SCROLL_AMOUNT) {
        scrollTopButton.style.display = "block"
    } else {
        scrollTopButton.style.display = "none"
    }
}

function arrayEquals(a, b) {
    return (Array.isArray(a) && Array.isArray(b)) && (a.length === b.length) && a.every((val, index) => val === b[index]);
}

Array.prototype.intersect = function(arr2) { return this.filter(x => arr2.includes(x)); }
Array.prototype.intersectTracks = function(arr2) { return this.filter(x => arr2.some(y => {return y.name == x.name && arrayEquals(y.artists, x.artists)})); }
Array.prototype.diff = function(arr2) { return this.filter(x => !arr2.includes(x)); }
Array.prototype.diffTracks = function(arr2) { return this.filter(x => !arr2.some(y => {return y.name == x.name && arrayEquals(y.artists, x.artists)})); }


function multiselectChange(options, property){
    if (Array.isArray(options)){
        for (const option of options){
            let index = property.indexOf(option.val());
            if (index !== -1){
                property.splice(index, 1);
            }
            else{
                property.push(option.val());
            }
        }
    }
    else{
        let index = property.indexOf(options.val());
        if (index !== -1){
            property.splice(index, 1);
        }
        else{
            property.push(options.val());
        }
    }
}


function getMultiselectData(property, nonSelectedText = "Select Playlists"){
    return {
        buttonClass: 'form-select form-select-lg text-start',
        buttonContainer: '<div class="btn-group d-grid"></div>',
        templates: {
            button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>',
        },
        nonSelectedText: nonSelectedText,
        includeSelectAllOption: true,
        selectAllText: 'Select All',
        selectAllNumber: true,
        enableFiltering: true,
        buttonTextAlignment: 'left',
        maxHeight: 600,
        numberDisplayed: 0,
        onChange: (options) => multiselectChange(options, property),
        onSelectAll: (options) => multiselectChange(options, property),
        onDeselectAll: (options) => multiselectChange(options, property),
    };
}

function getAccessToken(authCode, onSuccess, codeVerifier = null){
    $.ajax({
        url: "https://accounts.spotify.com/api/token",
        type: "POST",
        data: {
            grant_type: "authorization_code",
            code: authCode,
            redirect_uri: HOME_URL,
            // client_id: CLIENT_ID,
            // code_verifier: codeVerifier
        },
        headers: {
            "Authorization": "Basic " + btoa(CLIENT_ID+":"+CLIENT_SECRET),
            "Content-Type": "application/x-www-form-urlencoded"
        },
        success: function(response){
            response["expires_in"] += Date.now() / 1000;
            localStorage.setItem("accessTokenData", JSON.stringify(response));
            onSuccess(response.access_token);
        },
        error: function(response){
            throw(response.error);
        },
    })
}

// Something doesn't work when 
// function generateId(len = 50) {
//     var arr = new Uint8Array(len / 2);
//     crypto.getRandomValues(arr);
//     return Array.from(arr, (dec) => {return dec.toString(16).padStart(2, "0")}).join('');
// }
// var SHA256 = new Hashes.SHA256;

function auth(){
    // const code_verifier = generateId();
    // sessionStorage.setItem("verifier", code_verifier);
    // const code_challenge = SHA256.b64(code_verifier);

    data = {
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: HOME_URL,
        scope: "playlist-read-private",
        // code_challenge_method: "S256",
        // code_challenge: code_challenge
    };

    window.location.href = "https://accounts.spotify.com/authorize?" + new URLSearchParams(data).toString();
}

function getAccessTokenRefreshed(refreshToken, onSuccess){
    $.ajax({
        url: "https://accounts.spotify.com/api/token",
        type: "POST",
        data: {
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            // client_id: CLIENT_ID
        },
        headers: {
            "Authorization": "Basic " + btoa(CLIENT_ID+":"+CLIENT_SECRET),
            "Content-Type": "application/x-www-form-urlencoded"
        },
        success: function(response){
            response["expires_in"] += Date.now() / 1000;
            localStorage.setItem("accessTokenData", JSON.stringify(response));
            onSuccess(response.access_token);
        },
        error: function(response){
            throw(response.error);
        },
    })
}

function getTracksTableHTML(tracks){
    return `
    <div class="table-responsive" style="max-height: 500px">
    <table class="table table-dark table-bordered table-striped">
        <thead>
            <tr>
                <th scope="col">Title</th>
                <th scope="col">Artist</th>
            </tr>
        </thead>
        <tbody>
            ${(() => {
                let res = "";
                for (let t of tracks){
                    res += `
                    <tr>
                        <td>${t.name || "<i>Various Artists (Missing title - deleted song?)</i>"}</td>
                        <td>${t.artists.join(", ") || "<i>Various Artists (Missing artists - deleted song?)</i>"}</td>
                    </tr>
                    `;
                }
                return res;
            })()}
        </tbody>
    </table>
    </div>
    `;
}

var API = new SpotifyWebApi();

Vue.createApp({
    setup(){
        const ACCESS_TOKEN = Vue.ref("");
        const playlists = Vue.ref([]);
        const playlistTracks = Vue.ref({});

        const duplicatesSelected = Vue.ref("");
        const commonSelected1 = Vue.ref("");
        const commonSelected2 = Vue.ref("");
        const diffSelected1 = Vue.ref("");
        const diffSelected2 = Vue.ref([]);
        const backupSelected = Vue.ref([]);
        const artistsSelected = Vue.ref([]);

        return {ACCESS_TOKEN, playlists, playlistTracks, duplicatesSelected, commonSelected1, commonSelected2, diffSelected1, diffSelected2, backupSelected, artistsSelected};
    },
    computed: {
        console: () => console,
        window: () => window,
    },
    beforeMount(){
        let accessTokenData = JSON.parse(localStorage.getItem("accessTokenData"));
        if (accessTokenData){
            if (accessTokenData["expires_in"] > (Date.now() / 1000)){
                this.setAccessToken(accessTokenData["access_token"]);
            }
            else if ("refresh_token" in accessTokenData){
                getAccessTokenRefreshed(accessTokenData.refresh_token, this.setAccessToken);
            }
        }

        const queryParams = new URLSearchParams(window.location.search);
        if (!this.ACCESS_TOKEN && queryParams.has("code")){
            getAccessToken(queryParams.get("code"), this.setAccessToken);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        window.onbeforeunload = () => {
            sessionStorage.playlistTracks = JSON.stringify(this.playlistTracks);
        }
        if (sessionStorage.playlistTracks){
            this.playlistTracks = JSON.parse(sessionStorage.playlistTracks);
        }
    },
    mounted(){
        this.$nextTick(() => {
            if (this.playlists){
                $("#diffMultiselect").multiselect(getMultiselectData(this.diffSelected2));
                $("#backupMultiselect").multiselect(getMultiselectData(this.backupSelected, "Select Playlists to Backup"));
                $("#artistsMultiselect").multiselect(getMultiselectData(this.artistsSelected));
            }
        });
    },
    methods: {
        setAccessToken(accessToken){
            this.ACCESS_TOKEN = accessToken;
            API.setAccessToken(accessToken);
            
            this.getPlaylists();
        },
        authenticate(){
            sessionStorage.clear();
            auth();
        },
        disconnect(){
            localStorage.removeItem("accessTokenData");
            sessionStorage.clear();
            this.ACCESS_TOKEN = "";
        },
        getPlaylists(){
            let playlists = JSON.parse(sessionStorage.playlists || null);
            if (playlists && playlists.length){
                this.playlists = playlists;
            }
            else{
                API.getUserPlaylists(options={limit: 50}, (err, res) => {
                    this.playlists = res.items.map((i) => {return {id: i.id, name: i.name, total: i.tracks.total}});
                    sessionStorage.playlists = JSON.stringify(this.playlists);
                    this.$nextTick(() => {
                        $("#diffMultiselect").multiselect(getMultiselectData(this.diffSelected2));
                        $("#diffMultiselect").multiselect('rebuild');
                        $("#backupMultiselect").multiselect(getMultiselectData(this.backupSelected, "Select Playlists to Backup"));
                        $("#backupMultiselect").multiselect('rebuild');
                        $("#artistsMultiselect").multiselect(getMultiselectData(this.artistsSelected));
                        $("#artistsMultiselect").multiselect('rebuild');
                    })
                });
            }
        },
        async getTracks(playlistID){
            if (playlistID in this.playlistTracks){
                return this.playlistTracks[playlistID];
            }
            else{
                return await new Promise(resolve => {
                    this.playlistTracks[playlistID] = [];
                    let total = this.playlists.find(p => p.id === playlistID).total;
                    let n = Math.ceil(total / 100)
                    for (let i = 0; i < n; i++){
                        API.getPlaylistTracks(playlistID, {fields: "items(track(name, artists(name)))", offset: i*100}, (err, res) => {
                            this.playlistTracks[playlistID] = this.playlistTracks[playlistID].concat(res.items.map(i => {
                                return {
                                    name: i.track.name, 
                                    artists: i.track.artists.map(a => a.name)
                                }
                            }));

                            if (this.playlistTracks[playlistID].length == total) {
                                resolve(this.playlistTracks[playlistID])
                            }
                        })
                    }
                });
            }
        },
        async findDuplicates(){
            let tracks = await this.getTracks(this.duplicatesSelected);

            let seen = {};
            let dupes = [];
            for (var [index, track] of tracks.entries()){
                let name = track.name.toLowerCase();

                if (name in seen){
                    if (tracks[seen[name]].artists.intersect(track.artists).length > 0){
                        dupes.push(track);
                    }
                }
                else{
                    seen[name] = index;
                }
            }

            let playlistName = this.playlists.find(p => p.id === this.duplicatesSelected).name;

            let resultHTML;
            if (dupes.length){
                resultHTML = `
                <h5 class="my-3">${dupes.length} Duplicate${dupes.length > 1 ? "s" : ""} found in <span class="fw-lighter">"${playlistName}"</span>:</h5>
                ${getTracksTableHTML(dupes)}
                `;
            }
            else{
                resultHTML = `<h5 class="mt-4 text-center">No Duplicates found in <span class="fw-lighter">"${playlistName}"</span></h5>`;
            }
            $("#duplicatesResult").html(resultHTML);
        },
        async findCommon(){
            let tracks1 = await this.getTracks(this.commonSelected1);
            let tracks2 = await this.getTracks(this.commonSelected2);

            let commonTracks = tracks1.intersectTracks(tracks2);

            let playlist1Name = this.playlists.find(p => p.id === this.commonSelected1).name;
            let playlist2Name = this.playlists.find(p => p.id === this.commonSelected2).name;

            let resultHTML;
            if (commonTracks.length){
                resultHTML = `
                <h5 class="my-3">${commonTracks.length} Common Song${commonTracks.length > 1 ? "s" : ""} found for <span class="fw-lighter">"${playlist1Name}"</span> and <span class="fw-lighter">"${playlist2Name}"</span>:</h5>
                ${getTracksTableHTML(commonTracks)}
                `;
            }
            else{
                resultHTML = `<h5 class="mt-2 text-center">No Common Songs found for <span class="fw-lighter">"${playlist1Name}"</span> and <span class="fw-lighter">"${playlist2Name}"</span></h5>`;
            }
            $("#commonResult").html(resultHTML);
        },
        async findDiff(){
            let tracks1 = await this.getTracks(this.diffSelected1);
            let tracks2 = [];
            for (let playlistID of this.diffSelected2){
                let tracks = await this.getTracks(playlistID);
                tracks2.push(...tracks);
            }

            let diffTracks = tracks1.diffTracks(tracks2);

            let playlist1Name = this.playlists.find(p => p.id === this.diffSelected1).name;
            let playlist2Names = this.diffSelected2.map(id => this.playlists.find(p => p.id === id).name);

            let resultHTML;
            if (diffTracks.length){
                resultHTML = `
                <h5 class="my-3">${diffTracks.length} Unique Song${diffTracks.length > 1 ? "s" : ""} found in <span class="fw-lighter">"${playlist1Name}"</span>, which are not in <span class="fw-lighter">"${playlist2Names.join(", ")}"</span>:</h5>
                ${getTracksTableHTML(diffTracks)}
                `;
            }
            else{
                resultHTML = `<h5 class="mt-2 text-center">All Songs in <span class="fw-lighter">"${playlist1Name}"</span> are also in <span class="fw-lighter">"${playlist2Names.join(", ")}"</span></h5>`;
            }
            $("#diffResult").html(resultHTML);
        },
        async getBackup(){
            backup = []

            for (let playlistID of this.backupSelected){
                let playlist = this.playlists.find(p => p.id === playlistID)
                let tracks = await this.getTracks(playlistID)

                tracks = tracks.map((track) => {
                    return `${track.artists.join(", ")} - ${track.name}`
                }, tracks)

                backup.push({
                    playlist_name: playlist.name,
                    track_count: playlist.total,
                    tracks: tracks
                })
            }

            let dataStr = JSON.stringify(backup, null, 2);
            let dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

            let linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', "SpotifyBackup.json");
            linkElement.click();
        },
        async getArtists(){
            let mainData = []
            let artistsDetails = {}

            for (let playlistID of this.artistsSelected){
                let playlistName = this.playlists.find(p => p.id === playlistID).name
                let tracks = await this.getTracks(playlistID)

                for (let track of tracks){
                    let details = {
                        name: track.name || "Various Artists (Missing title - deleted song?)",
                        artists: track.artists.join(", ") || "Various Artists (Missing artists - deleted song?)",
                        playlist: playlistName
                    }
                    for (let artist of track.artists){
                        if (!artist){
                            artist = "Various Artists"
                        }

                        if (artist in artistsDetails){
                            artistsDetails[artist].push(details)
                        }
                        else{
                            artistsDetails[artist] = [details]
                        }
                    }
                }
            }

            if (artistsDetails.length == 0) return

            for (var [artist, details] of Object.entries(artistsDetails)){
                mainData.push({
                    artist: artist,
                    track_count: details.length,
                })
            }
            mainData.sort((a, b) => b.track_count - a.track_count)

            const setRank = (curRank, toRank) => {
                let toRankLen = toRank.length
                let rank = curRank
                if (toRankLen > 1){
                    rank = `${curRank} - ${curRank+toRankLen-1}`
                }
                for (a of toRank){
                    a.rank = rank
                }
                toRank.length = 0
                return curRank + toRankLen
            }
            let toRank = []
            let curRank = 1
            let curTrackCount = mainData[0].track_count
            for (artist of mainData){
                if (artist.track_count !== curTrackCount){
                    curRank = setRank(curRank, toRank)
                    curTrackCount = artist.track_count
                }
                toRank.push(artist)
            }
            setRank(curRank, toRank)

            $("#artistsResult").html("<table></table>").find("table").bootstrapTable({
                columns: [
                    {
                        field: "rank",
                        title: "Rank",
                        sortable: false,
                        align: "right",
                        halign: "right",
                        width: 10,
                        widthUnit: "%"
                    },
                    {
                        field: "track_count",
                        title: "Track Sum",
                        sortable: true,
                        align: "right",
                        halign: "left",
                        width: 10,
                        widthUnit: "%"
                    },
                    {
                        field: "artist",
                        title: "Artist",
                        sortable: true,
                        width: 80,
                        widthUnit: "%"
                    }
                ],
                data: mainData,
                detailView: true,
                detailViewByClick: true,
                detailViewAlign: "right",
                search: true,
                pagination: true,
                pageList: [10, 25, 50, 100, "all"],
                classes: 'table table-bordered table-hover table-striped table-dark',
                onExpandRow: (index, row, $detail) => {
                    this.expandArtist($detail, artistsDetails[row.artist])
                }
            })
        },
        expandArtist($el, artistDetails){
            $el.html(`
            <div class="d-flex">
                <i class="bi bi-arrow-return-right p-2"></i>
                <div class="flex-grow-1">
                    <table></table>
                </div>
            </div>
            `).find('table').bootstrapTable({
                columns: [
                    {
                        field: "artists",
                        title: "Artists",
                        sortable: true,
                        width: 40,
                        widthUnit: "%"
                    },
                    {
                        field: "name",
                        title: "Title",
                        sortable: true,
                        width: 40,
                        widthUnit: "%"
                    },
                    {
                        field: "playlist",
                        title: "Playlist",
                        sortable: true,
                        width: 20,
                        widthUnit: "%"
                    }
                ],
                data: artistDetails,
                classes: 'table table-bordered table-striped table-dark table-sm',
            })
        },
    }
}).mount("#app")
