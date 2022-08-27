const CLIENT_ID = "d347cce711f34e3bbfe5f52689e46c09";
const CLIENT_SECRET = "5a459975172742f992d247bd1050e84e";
// const HOME_URL = "http://127.0.0.1:5500/index.html";
const HOME_URL = "https://itzterra.github.io/SpotifyTools/";

function arrayEquals(a, b) {
    return (Array.isArray(a) && Array.isArray(b)) && (a.length === b.length) && a.every((val, index) => val === b[index]);
}

Array.prototype.intersect = function(arr2) { return this.filter(x => arr2.includes(x)); }
Array.prototype.intersectTracks = function(arr2) { return this.filter(x => arr2.some(y => {return y.name == x.name && arrayEquals(y.artists, x.artists)})); }
Array.prototype.diff = function(arr2) { return this.filter(x => !arr2.includes(x)); }
Array.prototype.diffTracks = function(arr2) { return this.filter(x => !arr2.some(y => {return y.name == x.name && arrayEquals(y.artists, x.artists)})); }

const multiselectData = {
    buttonClass: 'form-select form-select-lg text-start',
    buttonContainer: '<div class="btn-group d-grid"></div>',
    templates: {
        button: '<button type="button" class="multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>',
    },
    nonSelectedText: 'Select Playlists',
    includeSelectAllOption: true,
    selectAllText: 'Select All',
    selectAllNumber: true,
    enableFiltering: true,
    buttonTextAlignment: 'left',
    maxHeight: 600,
    numberDisplayed: 0,
    onChange: this.diffSelected2Change,
    onSelectAll: this.diffSelected2Change,
    onDeselectAll: this.diffSelected2Change
};

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
    <table class="table table-dark">
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

        return {ACCESS_TOKEN, playlists, playlistTracks, duplicatesSelected, commonSelected1, commonSelected2, diffSelected1, diffSelected2};
    },
    computed: {
        console: () => console,
        window: () => window,
    },
    beforeMount(){
        let accessTokenData = JSON.parse(localStorage.getItem("accessTokenData"));

        if (accessTokenData){
            if (accessTokenData["expires_in"] >  (Date.now() / 1000)){
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
                $("#multiselect").multiselect(multiselectData);
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
                    $("#multiselect").multiselect(multiselectData);
                    $("#multiselect").multiselect('rebuild');
                });
            }
        },
        getTracks(playlistID, callbackFn){
            if (playlistID in this.playlistTracks){
                return this.playlistTracks[playlistID];
            }
            else{
                this.playlistTracks[playlistID] = [];
                let total = this.playlists.find(p => p.id === playlistID).total;
                let n = Math.ceil(this.playlists.find(p => p.id === playlistID).total / 100)
                for (let i = 0; i < n; i++){
                    API.getPlaylistTracks(playlistID, {fields: "items(track(name, artists(name)))", offset: i*100}, (err, res) => {
                        this.playlistTracks[playlistID] = this.playlistTracks[playlistID].concat(res.items.map(i => {
                            return {
                                name: i.track.name, 
                                artists: i.track.artists.map(a => a.name)
                            }
                        }));
                        if (this.playlistTracks[playlistID].length == total) callbackFn();
                    })
                }
            }
        },
        findDuplicates(){
            let tracks = this.getTracks(this.duplicatesSelected, this.findDuplicates);
            if (tracks){
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
            }
        },
        findCommon(){
            let tracks1 = this.getTracks(this.commonSelected1, this.findCommon);
            let tracks2 = this.getTracks(this.commonSelected2, this.findCommon);
            if (tracks1 && tracks2){
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
            }
        },
        diffSelected2Change(options){
            if (Array.isArray(options)){
                for (const option of options){
                    let index = this.diffSelected2.indexOf(option.val());
                    if (index !== -1){
                        this.diffSelected2.splice(index, 1);
                    }
                    else{
                        this.diffSelected2.push(option.val());
                    }
                }
            }
            else{
                let index = this.diffSelected2.indexOf(options.val());
                if (index !== -1){
                    this.diffSelected2.splice(index, 1);
                }
                else{
                    this.diffSelected2.push(options.val());
                }
            }
        },
        findDiff(){
            let tracks1 = this.getTracks(this.diffSelected1, this.findDiff);
            let tracks2 = [];
            for (let p of this.diffSelected2){
                let t = this.getTracks(p, this.findDiff);
                if (t){
                    tracks2.push(...t);
                }
                else{
                    return
                }
            }

            if (tracks1 && tracks2){
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
            }
        },
    }
}).mount("#app")
