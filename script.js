document.getElementById("playlistForm").addEventListener("submit", function (event) {
	event.preventDefault();
	
	const clientId = '1eb3528b7fc84e6cb4e0a6499af25b50';
	const redirectUri = 'http://127.0.0.1:5500/index.html';
	const scopes = 'playlist-read-private'; // Add any additional scopes your application needs
	
	
	if (window.location.hash.includes('access_token')) fetchAllTracks(
		window.location.hash.substring(1).split('&').reduce((acc, pair) => {
		const [key, value] = pair.split('=');
		if (key === 'access_token') acc = value;
		return acc;
	}, ''), `https://api.spotify.com/v1/playlists/${document.getElementById("playlistUrl").value.split("/playlist/")[1]}`)
	else window.location.href = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes)}`;

	
});

async function fetchAllTracks(accessToken, playlistUrlApi) {
    document.getElementById("playlistUrl").insertAdjacentHTML("afterend", `<meter id="download" value="0" min="0"></meter><br>`)

    async function fetchTracks(url) {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

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

    fetchTracks(playlistUrlApi);
}

async function fetchArtist(artistName) {
	const response = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(artistName)}&fmt=json`);
	const data = await response.json();
	return data.artists[0];
}

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let i = 0;
let correct = 0
let incorrect = 0
let tracks = [];
let artist = {}
let track = {}
let question = {}

async function displayQuestion() {
	const questionContainer = document.getElementById("questionContainer");
	track = tracks.sort(() => 0.5-Math.random())[i]
	artist = await fetchArtist(track.artists[0].name);	
	var validTypes = questionTypes.filter(q => !q.requirements().some(item => item === undefined));
	validTypes = questionTypes.filter(q => Array.from(document.querySelectorAll('#selectedQuestions input:checked')).map(checkbox => checkbox.id).indexOf(encodeURIComponent(q.name)) != -1)
	question = validTypes[Math.floor(Math.random() * validTypes.length)];
	questionContainer.innerHTML = `<img src="${question.image()}"></img><p>${i+1}: ${await question.question()}</p>
	<input type="text" id="answer" required>`;
	document.getElementById("answer").focus()
	document.getElementById("answer").addEventListener("keypress", function(event) {
	if (event.key === "Enter") {
		const resultContainer = document.getElementById("resultContainer");
		if (question.answers().indexOf(document.getElementById("answer").value) > -1) resultContainer.innerHTML = "<p>Correct!</p>", correct++
		else resultContainer.innerHTML = `<p>Incorrect. The correct answer is ${question.answers()[0]}.`, incorrect++
		resultContainer.innerHTML += `<p>Correct: ${correct}</p><p>Incorrect: ${incorrect}</p>`
		i++;
		displayQuestion();
	}
})
}
