# Spotify Tools
Useful tools for Spotify playlists.

***---THE HOSTED API APP IS FREE SO YOU CANNOT CONNECT NON-WHITELISTED SPOTIFY ACCOUNTS---***

> Feel free to fork and use your own [Spotify API](https://developer.spotify.com/) app (`CLIENT_ID` and `CLIENT_SECRET`).


## Features
- Find duplicate tracks in a playlist
- Find tracks that two playlists share
- Find the track difference of one playlist against others
- Backup artist and track names from selected playlists as JSON
- Rank artists from playlists based on number of their tracks in the playlist

## Tips
You can't choose "Liked Songs" (the hearted ones) as they are not a playlist.  
--> Convert them with Select All (Ctrl-A) and add them into a playlist.

## Possible improvements
- Use a Vue component to render result tables
- Use secret code challenges in the API calls for security

## Made with
- <a href="https://vuejs.org/" target="_blank"><strong style="color: #42b883">Vue3</strong></a> reactivity
- <a href="https://getbootstrap.com/" target="_blank"><strong style="color: #7734fb">Bootstrap5</strong></a> styles
