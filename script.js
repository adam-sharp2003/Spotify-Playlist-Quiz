const clientId = '1eb3528b7fc84e6cb4e0a6499af25b50';
const redirectUri = 'https://adam-sharp2003.github.io/Spotify-Playlist-Quiz/'
const access_token = window.location.hash.substring(1).split('&').reduce((acc, pair) => (pair.startsWith('access_token=') ? pair.split('=')[1] : acc), '')

var playListTypes = {
	Custom: () => '<label for="playlistUrl">Enter Spotify Playlist URL:</label><input type="text" id="playlistUrl" required>',
	Library: async () => {
		document.getElementById("playlist").insertAdjacentHTML("afterend", `<meter id="download" value="0" min="0"></meter>`)
		async function fetchPlaylists(url) {
			const response = await fetch(url, {
				headers: {
					Authorization: `Bearer ${access_token}`,
				},
			});
			const data = await response.json();
			document.getElementById("download").max = data.total
			document.getElementById("download").value += 20
			playlists = playlists.concat(data.items);
			if (data.next) await fetchPlaylists(data.next)
		}
		if (!playlists.length) await fetchPlaylists(`https://api.spotify.com/v1/me/playlists/`);
		document.getElementById("download").remove()
		return `<label for="playlistUrl">Select Spotify Playlist:</label>
		<select name="playlistUrl" id="playlistUrl">` + playlists.map(p => `<option value="${p.external_urls.spotify}">${p.name}</option>)`).join('') + '</select>'
	}
}

document.getElementById(`playlistForm`).innerHTML = !window.location.hash.includes('access_token') ?
	`<button onclick=login()>Login to Spotify</button><div id="playlistType" style="display: none"></div>`:
	`<select name="playlistType" id="playlistType">`+ Object.keys(playListTypes).map(p => `<option value="${p}">${p}</option>`).join() + `</select>
	<div id=playlist style="display: contents;">${playListTypes["Custom"]()}</div>
	<button type="submit">Start Quiz</button>`

document.getElementById("playlistType").onchange = async value => document.getElementById("playlist").innerHTML = await playListTypes[value.target.value]()

function login() {
	window.location.href = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=${encodeURIComponent('playlist-read-private')}`;
}

document.getElementById("playlistForm").addEventListener("submit", async function (event) {
	event.preventDefault();
	document.getElementById("playlistUrl").insertAdjacentHTML("afterend", `<meter id="download" value="0" min="0"></meter><br>`)

	async function fetchTracks(url) {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${access_token}`,
			},
		});
		if (response.status == 401) window.location.href = redirectUri
		const data = await response.json();
		document.getElementById("download").max = data.tracks ? data.tracks.total : data.total
		document.getElementById("download").value += 100
		tracks = tracks.concat(data.tracks ? data.tracks.items.map((item) => item.track) : data.items.map((item) => item.track));
		
		const nextUrl = data.tracks ? data.tracks.next : data.next;
		if (nextUrl) await fetchTracks(nextUrl)
		else {
			document.getElementById("download").remove()
			displayQuestion();
		}
	}

	tracks = []
	fetchTracks(`https://api.spotify.com/v1/playlists/${document.getElementById("playlistUrl").value.split("/playlist/")[1]}`);
	
});

const fetchArtist = async artistName => (await (await fetch(`https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(artistName)}&fmt=json`)).json()).artists[0];

const questionTypes = [
	{
		name: "Release Date",
		requirements: () => [],
		question: () => `In which year was the song "${track.name}" by ${track.artists[0].name} released?`,
		answers: () => [(new Date(track.album.release_date)).getFullYear().toString()],
		image: () => track.album.images[0].url
	},
	{
		name: "Artist",
		requirements: () => [],
		question: () => `Who is the primary artist of the song "${track.name}" (${(new Date(track.album.release_date)).getFullYear()})?`,
		answers: () => artist.aliases ? [track.artists[0].name].concat(...(artist.aliases.map(a => a.name))) : [track.artists[0].name],
		image: () => ""
	},
	{
		name: "Duration",
		requirements: () => [],
		question: () => `How many minutes long is the song "${track.name}" by ${track.artists[0].name}?`,
		answers: () => [Math.floor(track.duration_ms / 60000).toString()],
		image: () => track.album.images[0].url
	},
	{
		name: "Album Name",
		requirements: () => [],
		question: () => `What is the album name of the song "${track.name}" by ${track.artists[0].name}?`,
		answers: () => [track.album.name.replace(/\([^)]*\)/g, '').trim()],
		image: () => ""
	},
	{
		name: "Date Artist Born / Founded",
		requirements: () => [artist["life-span"].begin],
		question: () => `In which year was ${artist.name} ${artist.type == "Person" ? "born": "founded"}?`,
		answers: () => [(new Date(artist["life-span"].begin)).getFullYear().toString()],
		image: () => track.album.images[0].url
	},
	{
		name: "Country Artist Born / Founded",
		requirements: () => [artist.area],
		question: () => `Which country was ${artist.name} ${artist.type == "Person" ? "born":"founded"}?`,
		answers: () => [artist.area.name],
		image: () => track.album.images[0].url
	},
];

document.getElementById('selectedQuestions').innerHTML = questionTypes.map(q => `<input type="checkbox" id="${encodeURIComponent(q.name)}" checked><label for="${encodeURIComponent(q.name)}">${q.name}</label>`).join('')

let i = 0, correct = 0, incorrect = 0, tracks = [], artist = {}, track = {}, question = {}, playlists = []

async function displayQuestion() {
	track = tracks.sort(() => 0.5-Math.random())[i], artist = await fetchArtist(track.artists[0].name);	
	var validTypes = questionTypes.filter(q => !q.requirements().some(item => item === undefined)).filter(q => Array.from(document.querySelectorAll('#selectedQuestions input:checked')).map(c => c.id).includes(encodeURIComponent(q.name)));
	question = validTypes[Math.floor(Math.random() * validTypes.length)];
	document.getElementById("questionContainer").innerHTML = `<img src="${question.image()}"></img><p>${i+1}: ${await question.question()}</p><input type="text" id="answer" required>`;
	document.getElementById("answer").disabled = true
	await new Promise(resolve => setTimeout(resolve, 500))
	document.getElementById("answer").disabled = false
	document.getElementById("answer").focus()
	document.getElementById("answer").addEventListener("keypress", function(event) {
		if (event.key === "Enter") {
			const resultContainer = document.getElementById("resultContainer");
			if (question.answers().indexOf(document.getElementById("answer").value) > -1) resultContainer.innerHTML = "<p>Correct!</p>", correct++
			else resultContainer.innerHTML = `<p>Incorrect. The correct answer is ${question.answers()[0]}.`, incorrect++
			document.getElementById("answer").remove()
			resultContainer.innerHTML += `<p>Correct: ${correct}</p><p>Incorrect: ${incorrect}</p>`
			i++;
			displayQuestion();
		}
	})
}
