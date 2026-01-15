// --- CONFIGURATION ---
const API_KEY = '21ecdb63'; 

// --- DOM ELEMENTS ---
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const micBtn = document.getElementById('micBtn');
const historyContainer = document.getElementById('searchHistory');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const watchlistBtn = document.getElementById('watchlistBtn');
const sortSelect = document.getElementById('sortOptions');
const movieGrid = document.getElementById('movieGrid');
const loader = document.getElementById('loader');
const errorMsg = document.getElementById('errorMessage');
const sectionTitle = document.getElementById('sectionTitle');
const modal = document.getElementById('movieModal');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.querySelector('.close-btn');
const filterRadios = document.querySelectorAll('input[name="type"]');

// --- STATE MANAGEMENT ---
let currentMovies = []; 
let watchlist = JSON.parse(localStorage.getItem('movieWatchlist')) || [];
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
let isWatchlistMode = false;
let currentPage = 1;
let currentQuery = "Trending"; 
let currentType = ""; 

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadTrending(); // <--- UPDATED: Loads the "Trending" row instead of a generic search
    renderHistory();
    
    // Navbar Scroll Effect
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar');
        if (window.scrollY > 50) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    });
});


// --- EVENT LISTENERS ---
searchBtn.addEventListener('click', () => handleNewSearch(searchInput.value));

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleNewSearch(searchInput.value);
});

loadMoreBtn.addEventListener('click', loadNextPage);
micBtn.addEventListener('click', startVoiceSearch);
watchlistBtn.addEventListener('click', toggleWatchlistMode);
sortSelect.addEventListener('change', handleSort);
closeBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { 
    if (e.target.classList.contains('modal-backdrop')) closeModal(); 
});

filterRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        currentType = e.target.value;
        if(currentQuery) handleNewSearch(currentQuery);
    });
});

// --- CORE FUNCTIONS ---

function handleNewSearch(query) {
    if (!query.trim()) return;
    
    currentPage = 1;
    currentQuery = query;
    isWatchlistMode = false;
    updateWatchlistButtonState();
    addToHistory(query);
    
    // Scroll to grid slightly
    document.querySelector('main').scrollIntoView({ behavior: 'smooth' });

    initiateSearch(query, 1);
}

async function initiateSearch(query, page = 1) {
    if (page === 1) {
        movieGrid.innerHTML = '';
        errorMsg.classList.add('hidden');
        sectionTitle.classList.add('hidden');
        loader.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
    } else {
        loadMoreBtn.innerHTML = 'Loading...';
        loadMoreBtn.disabled = true;
    }

    try {
        let url = `https://www.omdbapi.com/?s=${query.trim()}&page=${page}&apikey=${API_KEY}`;
        if(currentType) url += `&type=${currentType}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.Response === "False") {
            if (page === 1) showError("No results found. Try a different title.");
            else showToast("No more results available.");
            loader.classList.add('hidden');
            return;
        }

        if (page === 1) currentMovies = data.Search;
        else currentMovies = [...currentMovies, ...data.Search];

        renderMovies(data.Search, false, page > 1);
        loader.classList.add('hidden');
        
        const totalResults = parseInt(data.totalResults);
        if (currentMovies.length < totalResults) {
            loadMoreBtn.classList.remove('hidden');
            loadMoreBtn.innerHTML = 'Load More Results';
            loadMoreBtn.disabled = false;
        } else {
            loadMoreBtn.classList.add('hidden');
        }
        
        fetchDetailsBackground(data.Search);

    } catch (error) {
        showError("Network error. Please try again.");
        loader.classList.add('hidden');
    }
}

function loadNextPage() {
    currentPage++;
    initiateSearch(currentQuery, currentPage);
}

// --- RENDER ---
// In renderMovies function:
// --- RENDER LOGIC (Updated for Better Placeholders) ---
function renderMovies(movies, isWatchlistRender = false, append = false) {
    if (!append && !isWatchlistRender && movies !== currentMovies) movieGrid.innerHTML = '';

    movies.forEach((movie, index) => {
        const isLiked = watchlist.some(m => m.imdbID === movie.imdbID);
        
        // CHECK: Does this movie have a real poster?
        const hasPoster = movie.Poster && movie.Poster !== 'N/A';
        
        // If NO poster, we use a transparent pixel so our CSS background shows through
        const posterSrc = hasPoster ? movie.Poster : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        
        // If NO poster, add the 'missing-poster' class to trigger our new CSS
        const posterClass = hasPoster ? '' : 'missing-poster';

        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.opacity = '0';
        card.style.animation = `fadeInUp 0.5s ease forwards ${index * 0.05}s`;

        card.innerHTML = `
            <div class="like-btn ${isLiked ? 'liked' : ''}" title="Add to Watchlist">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
            </div>
            
            <div class="poster-container ${posterClass}">
                <img src="${posterSrc}" alt="${movie.Title}" loading="lazy">
            </div>
            
            <div class="card-info">
                <h3>${movie.Title}</h3>
                <div class="meta">
                    <span>${movie.Year}</span>
                    <span class="rating-star" id="rating-${movie.imdbID}">
                         ${movie.imdbRating ? `<i class="fas fa-star"></i> ${movie.imdbRating}` : ''}
                    </span>
                </div>
            </div>
        `;

        // Animation Keyframes check
        if(!document.getElementById('animStyles')) {
            const style = document.createElement('style');
            style.id = 'animStyles';
            style.innerHTML = `@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`;
            document.head.appendChild(style);
        }

        card.querySelector('.like-btn').addEventListener('click', (e) => toggleHeart(e, movie));
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.like-btn')) openModal(movie);
        });

        movieGrid.appendChild(card);
    });
}

// --- FEATURED & HERO LOGIC ---
// --- TRENDING / HOME PAGE LOGIC ---
async function loadTrending() {
    // 1. Setup UI
    loader.classList.remove('hidden');
    movieGrid.innerHTML = ''; // Clear existing
    sectionTitle.classList.remove('hidden');
    sectionTitle.innerHTML = `🔥 Trending Now <span style="font-size:0.9rem; color:#94a3b8; font-weight:400; margin-left:10px;">Top picks for you</span>`;
    
    // 2. Curated List of Global Hits (Simulating a "Trending" Algorithm)
    // We fetch these by exact title to ensure high-quality posters and data.
    const trendingTitles = [
        "Dune: Part Two",
        "Oppenheimer",
        "Barbie",
        "The Batman",
        "Spider-Man: Across the Spider-Verse",
        "Top Gun: Maverick",
        "Everything Everywhere All At Once",
        "Avatar: The Way of Water"
    ];

    try {
        // 3. Fetch all movies in parallel (Fastest method)
        const requests = trendingTitles.map(title => 
            fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${API_KEY}`)
            .then(res => res.json())
        );

        const results = await Promise.all(requests);

        // 4. Filter out any errors and render
        currentMovies = results.filter(m => m.Response === "True");
        
        // Render with "Trending" flag to avoid clearing the grid
        renderMovies(currentMovies, false, true); 
        
        loader.classList.add('hidden');
        loadMoreBtn.classList.add('hidden'); // Hide "Load More" for the trending view

    } catch (e) {
        // Fallback to a search if the specific fetch fails
        initiateSearch("2024");
    }
}

// --- WATCHLIST & MODAL (Standard) ---
function toggleWatchlistMode() {
    isWatchlistMode = !isWatchlistMode;
    updateWatchlistButtonState();
    if (isWatchlistMode) {
        renderWatchlist();
        loadMoreBtn.classList.add('hidden');
    } else {
        renderMovies(currentMovies);
        sectionTitle.classList.add('hidden');
        if(currentMovies.length > 0) loadMoreBtn.classList.remove('hidden');
    }
}

function updateWatchlistButtonState() {
    if (isWatchlistMode) {
        watchlistBtn.classList.add('active');
        watchlistBtn.innerHTML = `<i class="fas fa-arrow-left"></i> <span class="btn-text">Back to Home</span>`;
        sortSelect.disabled = true;
    } else {
        watchlistBtn.classList.remove('active');
        watchlistBtn.innerHTML = `<i class="fas fa-heart"></i> <span class="btn-text">My Watchlist</span>`;
        sortSelect.disabled = false;
    }
}

function toggleHeart(e, movie) {
    e.stopPropagation();
    const index = watchlist.findIndex(m => m.imdbID === movie.imdbID);
    if (index === -1) {
        watchlist.push(movie);
        showToast("Added to Watchlist");
    } else {
        watchlist.splice(index, 1);
        showToast("Removed from Watchlist");
    }
    localStorage.setItem('movieWatchlist', JSON.stringify(watchlist));
    
    const btn = e.currentTarget;
    const icon = btn.querySelector('i');
    btn.classList.toggle('liked');
    icon.classList.toggle('fas');
    icon.classList.toggle('far');
    
    if (isWatchlistMode) renderWatchlist();
}

function renderWatchlist() {
    movieGrid.innerHTML = '';
    sectionTitle.classList.remove('hidden');
    sectionTitle.innerText = `My Watchlist (${watchlist.length})`;
    if (watchlist.length === 0) {
        movieGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#64748b;">
            <i class="far fa-heart" style="font-size:3rem; margin-bottom:15px;"></i>
            <p>Your watchlist is empty.</p>
        </div>`;
        return;
    }
    renderMovies(watchlist, true);
}

// --- MODAL ---
async function openModal(movie) {
    // 1. Show the modal & lock background
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    modalBody.innerHTML = `<div class="spinner-ring"></div>`;

    let fullMovie = movie;
    
    // Fetch full details if needed
    if (!movie.Plot || !movie.Ratings) {
        try {
            const res = await fetch(`https://www.omdbapi.com/?i=${movie.imdbID}&apikey=${API_KEY}`);
            fullMovie = await res.json();
        } catch (e) {}
    }

    // HANDLE BROKEN POSTERS IN MODAL ---
    const posterSrc = (fullMovie.Poster && fullMovie.Poster !== 'N/A') 
        ? fullMovie.Poster 
        : 'https://via.placeholder.com/300x450/1e293b/888?text=No+Poster';

    // HANDLE "N/A" DATA ---
    const plotText = (fullMovie.Plot && fullMovie.Plot !== "N/A") 
        ? fullMovie.Plot 
        : "No plot description is available for this title.";

    // Helper to hide lines if data is missing (e.g. "Director: N/A")
    const getMeta = (label, value) => {
        if (!value || value === "N/A") return ""; // Return empty string if N/A
        return `<span style="color:#94a3b8; font-weight:600;">${label}</span> <span>${value}</span>`;
    };

    // Extract Rotten Tomatoes Score
    let rottenTomatoes = "N/A";
    if (fullMovie.Ratings) {
        const rtObj = fullMovie.Ratings.find(r => r.Source === "Rotten Tomatoes");
        if (rtObj) rottenTomatoes = rtObj.Value;
    }

    // Links
    const trailerLink = `https://www.youtube.com/results?search_query=${fullMovie.Title}+${fullMovie.Year}+trailer`;
    const netflixSearch = `https://www.netflix.com/search?q=${encodeURIComponent(fullMovie.Title)}`;
    const primeSearch = `https://www.amazon.com/s?k=${encodeURIComponent(fullMovie.Title)}`;
    const userNote = getUserNote(fullMovie.imdbID);

    modalBody.innerHTML = `
        <img src="${posterSrc}" class="modal-poster">
        <div class="modal-text">
            <h2 style="margin-bottom: 5px;">${fullMovie.Title}</h2>
            
            <div style="color:#94a3b8; margin-bottom:15px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                ${fullMovie.Rated !== "N/A" ? `<span class="mpa-rating">${fullMovie.Rated}</span>` : ''}
                <span>${fullMovie.Year}</span> 
                ${fullMovie.Runtime !== "N/A" ? `<span>•</span> <span>${fullMovie.Runtime}</span>` : ''}
            </div>

            <div style="display:flex; gap: 20px; margin-bottom: 20px;">
                ${fullMovie.imdbRating !== "N/A" ? `
                <div class="score-badge imdb">
                    <i class="fab fa-imdb"></i> <span>${fullMovie.imdbRating}</span>
                </div>` : ''}
                
                ${rottenTomatoes !== "N/A" ? `
                <div class="score-badge rt">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg" width="20"> 
                    <span>${rottenTomatoes}</span>
                </div>` : ''}
            </div>

            <div style="margin-bottom:20px;">
                ${(fullMovie.Genre && fullMovie.Genre !== "N/A") ? 
                    fullMovie.Genre.split(',').map(g => `<span class="tag">${g.trim()}</span>`).join('') 
                    : ''}
            </div>

            <p style="color:#cbd5e1; line-height:1.6; margin-bottom:25px;">${plotText}</p>
            
            <div style="display:grid; grid-template-columns: auto 1fr; gap:8px 15px; font-size:0.9rem; margin-bottom:25px;">
                ${getMeta("Director", fullMovie.Director)}
                ${getMeta("Cast", fullMovie.Actors)}
            </div>
            
            <h4 style="color:white; margin-bottom:10px;">Watch on:</h4>
            <div class="streaming-links">
                <a href="${netflixSearch}" target="_blank" class="stream-btn netflix">Netflix</a>
                <a href="${primeSearch}" target="_blank" class="stream-btn prime">Prime Video</a>
                <a href="${trailerLink}" target="_blank" class="stream-btn trailer"><i class="fab fa-youtube"></i> Trailer</a>
            </div>

            <div class="user-actions" style="margin-top: 25px; border-top:1px solid #334155; padding-top:20px;">
                <textarea id="userNoteInput" class="note-input" rows="2" placeholder="My thoughts on this...">${userNote}</textarea>
                <div style="margin-top:10px; display:flex; justify-content:flex-end;">
                    <button id="shareBtn" class="share-btn"><i class="fas fa-share-alt"></i> Share to Socials</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('userNoteInput').addEventListener('input', (e) => saveUserNote(fullMovie.imdbID, e.target.value));
    document.getElementById('shareBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(`Check out "${fullMovie.Title}" (${fullMovie.Year}) on MovieExplorer!`);
        showToast("Link copied to clipboard!");
    });
}

function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// --- UTILS ---
function saveUserNote(id, text) {
    let notes = JSON.parse(localStorage.getItem('movieNotes')) || {};
    notes[id] = text;
    localStorage.setItem('movieNotes', JSON.stringify(notes));
}
function getUserNote(id) {
    return (JSON.parse(localStorage.getItem('movieNotes')) || {})[id] || "";
}
function showError(msg) { errorMsg.innerText = msg; errorMsg.classList.remove('hidden'); }
function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Voice Search
function startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window)) { showToast("Voice search not supported in this browser."); return; }
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    micBtn.classList.add('listening');
    recognition.onresult = (e) => {
        const txt = e.results[0][0].transcript;
        searchInput.value = txt;
        handleNewSearch(txt);
        micBtn.classList.remove('listening');
    };
    recognition.onend = () => micBtn.classList.remove('listening');
}

// History
function addToHistory(query) {
    searchHistory = searchHistory.filter(i => i.toLowerCase() !== query.toLowerCase());
    searchHistory.unshift(query);
    if(searchHistory.length > 6) searchHistory.pop();
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    renderHistory();
}
function renderHistory() {
    historyContainer.innerHTML = '';
    searchHistory.forEach(term => {
        const chip = document.createElement('div');
        chip.className = 'history-chip';
        chip.innerText = term;
        chip.onclick = () => { searchInput.value = term; handleNewSearch(term); };
        historyContainer.appendChild(chip);
    });
}

// Background Fetch
async function fetchDetailsBackground(movies) {
    for (const movie of movies) {
        try {
            const res = await fetch(`https://www.omdbapi.com/?i=${movie.imdbID}&apikey=${API_KEY}`);
            const details = await res.json();
            const ratingEl = document.getElementById(`rating-${movie.imdbID}`);
            if(ratingEl && details.imdbRating !== "N/A") ratingEl.innerHTML = `<i class="fas fa-star"></i> ${details.imdbRating}`;
        } catch(e) {}
    }
}

function handleSort() {
    const criteria = sortSelect.value;
    let sorted = [...currentMovies];
    if (criteria === 'year_desc') sorted.sort((a, b) => parseInt(b.Year) - parseInt(a.Year));
    if (criteria === 'year_asc') sorted.sort((a, b) => parseInt(a.Year) - parseInt(b.Year));
    if (criteria === 'rating_desc') sorted.sort((a, b) => parseFloat(b.imdbRating||0) - parseFloat(a.imdbRating||0));
    renderMovies(sorted);
}

// --- SURPRISE ME LOGIC (Expanded) ---

// 1. Create a variable to track the last pick so we don't repeat it immediately
let lastSurpriseIndex = -1;

function triggerSurprise() {
    // 2. A much larger, diverse list of movies
    const surprisePicks = [
        // Sci-Fi & Action
        "Inception", "Interstellar", "The Matrix", "Dune", "Mad Max: Fury Road", 
        "Everything Everywhere All At Once", "The Dark Knight", "Avengers: Endgame", 
        "Blade Runner 2049", "Gladiator", "Terminator 2", "Aliens", "Top Gun: Maverick",
        
        // Drama & Classics
        "The Shawshank Redemption", "The Godfather", "Pulp Fiction", "Fight Club", 
        "Forrest Gump", "Goodfellas", "Parasite", "Joker", "Whiplash", "The Truman Show",
        
        // Animation
        "Spirited Away", "The Lion King", "Spider-Man: Into the Spider-Verse", 
        "Inside Out", "Coco", "Wall-E", "Up", "The Incredibles",
        
        // Horror & Thriller
        "Get Out", "A Quiet Place", "The Shining", "Seven", "Silence of the Lambs", 
        "Psycho", "Hereditary", "Jaws",
        
        // Comedy
        "Superbad", "The Hangover", "Groundhog Day", "Monty Python and the Holy Grail",
        "The Big Lebowski", "Knives Out"
    ];

    // 3. Logic to ensure we get a NEW random index different from the last one
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * surprisePicks.length);
    } while (randomIndex === lastSurpriseIndex);

    // Update the tracker
    lastSurpriseIndex = randomIndex;
    const chosenMovie = surprisePicks[randomIndex];

    // 4. UI Feedback
    const fabIcon = document.querySelector('.fab-circle i');
    fabIcon.className = "fas fa-spinner fa-spin"; // Spin icon while thinking

    setTimeout(() => {
        searchInput.value = chosenMovie;
        handleNewSearch(chosenMovie);
        fabIcon.className = "fas fa-dice"; // Restore icon
        showToast(`Surprise! How about "${chosenMovie}"?`);
    }, 500);
}

// --- FOOTER INFO MODALS ---
function openTextModal(type) {
    // 1. Open the modal container
    const modal = document.getElementById('movieModal');
    const modalBody = document.getElementById('modalBody');
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock background scrolling

    // 2. Define the content based on which button was clicked
    let title = "";
    let content = "";

    if (type === 'privacy') {
        title = "Privacy Policy";
        content = `
            <p style="margin-bottom:15px;"><strong>1. Data Collection:</strong> This is a portfolio demonstration project. We do not store your personal data, IP address, or search history on any external servers.</p>
            <p style="margin-bottom:15px;"><strong>2. Local Storage:</strong> Your "Watchlist" and "Notes" are stored entirely on your own device using your browser's LocalStorage. If you clear your browser cache, this data will be lost.</p>
            <p><strong>3. Third-Party Services:</strong> Movie data is fetched from the OMDb API. By using this service, you acknowledge that we display content provided by them.</p>
        `;
    } else if (type === 'terms') {
        title = "Terms of Use";
        content = `
            <p style="margin-bottom:15px;"><strong>1. Educational Use:</strong> This website was built for educational and portfolio purposes to demonstrate web development skills.</p>
            <p style="margin-bottom:15px;"><strong>2. Copyright:</strong> All movie posters, titles, and metadata are the property of their respective copyright owners and are displayed here under fair use for informational purposes via the OMDb API.</p>
            <p><strong>3. Disclaimer:</strong> The developer provides this service "as is" and is not responsible for any inaccuracies in the movie data.</p>
        `;
    }

    // 3. Inject the text into the modal (Clean, simple layout)
    modalBody.innerHTML = `
        <div style="padding: 10px; width: 100%;">
            <h2 style="color:white; font-size:2rem; margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 15px;">
                <i class="fas fa-shield-alt" style="color: var(--primary); margin-right:10px;"></i> ${title}
            </h2>
            <div style="color: #cbd5e1; line-height: 1.8; font-size: 1rem;">
                ${content}
            </div>
            
            <div style="margin-top: 30px; text-align: right;">
                <button onclick="closeModal()" style="background: var(--primary); color: white; border: none; padding: 10px 25px; border-radius: 4px; cursor: pointer; font-weight:600;">
                    Understood
                </button>
            </div>
        </div>
    `;
}