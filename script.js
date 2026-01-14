// --- CONFIGURATION ---
const API_KEY = '21ecdb63'; // Your Existing Key

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
const fallbackMsg = document.getElementById('fallbackMessage');
const sectionTitle = document.getElementById('sectionTitle');
const modal = document.getElementById('movieModal');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.querySelector('.close-btn');
const filterRadios = document.querySelectorAll('input[name="type"]'); // NEW

// --- STATE MANAGEMENT ---
let currentMovies = []; 
let watchlist = JSON.parse(localStorage.getItem('movieWatchlist')) || [];
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
let isWatchlistMode = false;
let currentPage = 1;
let currentQuery = "Avengers"; // Default fun start
let currentType = ""; // NEW: Track filter type (movie, series, episode)

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedMovies();
    renderHistory();
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
window.addEventListener('click', (e) => { if (e.target === document.querySelector('.modal-backdrop')) closeModal(); });

// NEW: Listener for Filters
filterRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        currentType = e.target.value;
        if(currentQuery) handleNewSearch(currentQuery);
    });
});

// --- SEARCH & PAGINATION LOGIC ---

function handleNewSearch(query) {
    if (!query.trim()) return;
    
    currentPage = 1;
    currentQuery = query;
    isWatchlistMode = false;
    updateWatchlistButtonState();
    addToHistory(query);
    
    initiateSearch(query, 1);
}

async function initiateSearch(query, page = 1) {
    if (page === 1) {
        movieGrid.innerHTML = '';
        fallbackMsg.classList.add('hidden');
        errorMsg.classList.add('hidden');
        sectionTitle.classList.add('hidden');
        loader.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
    } else {
        loadMoreBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Loading...`;
        loadMoreBtn.disabled = true;
    }

    try {
        // Updated API Call to include Type
        let url = `https://www.omdbapi.com/?s=${query.trim()}&page=${page}&apikey=${API_KEY}`;
        if(currentType) url += `&type=${currentType}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.Response === "False") {
            if (page === 1) {
                showError("No results found in this universe. Try another?");
            } else {
                loadMoreBtn.classList.add('hidden');
                showToast("You've reached the end of the list!");
            }
            loader.classList.add('hidden');
            return;
        }

        if (page === 1) {
            currentMovies = data.Search;
        } else {
            currentMovies = [...currentMovies, ...data.Search];
        }

        renderMovies(data.Search, false, page > 1);
        
        loader.classList.add('hidden');
        
        const totalResults = parseInt(data.totalResults);
        if (currentMovies.length < totalResults) {
            loadMoreBtn.classList.remove('hidden');
            loadMoreBtn.innerHTML = `<span>Load More</span> <i class="fas fa-chevron-down"></i>`;
            loadMoreBtn.disabled = false;
        } else {
            loadMoreBtn.classList.add('hidden');
        }
        
        fetchDetailsBackground(data.Search);

    } catch (error) {
        showError("Connection lost in space. Please check internet.");
        loader.classList.add('hidden');
    }
}

function loadNextPage() {
    currentPage++;
    initiateSearch(currentQuery, currentPage);
}

// --- VOICE SEARCH ---
function startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window)) {
        showToast("Voice search requires Chrome!", "error");
        return;
    }
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    micBtn.classList.add('listening');

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        searchInput.value = transcript;
        handleNewSearch(transcript);
        micBtn.classList.remove('listening');
    };
    recognition.onend = () => micBtn.classList.remove('listening');
}

// --- HISTORY ---
function addToHistory(query) {
    searchHistory = searchHistory.filter(item => item.toLowerCase() !== query.toLowerCase());
    searchHistory.unshift(query);
    if (searchHistory.length > 8) searchHistory.pop();
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    renderHistory();
}

function renderHistory() {
    historyContainer.innerHTML = '';
    searchHistory.forEach(term => {
        const chip = document.createElement('div');
        chip.className = 'history-chip';
        chip.innerHTML = `<i class="fas fa-history"></i> ${term}`;
        chip.onclick = () => {
            searchInput.value = term;
            handleNewSearch(term);
        };
        historyContainer.appendChild(chip);
    });
}

// --- BACKGROUND FETCH ---
async function fetchDetailsBackground(movies) {
    for (const movie of movies) {
        try {
            const res = await fetch(`https://www.omdbapi.com/?i=${movie.imdbID}&apikey=${API_KEY}`);
            const details = await res.json();
            const idx = currentMovies.findIndex(m => m.imdbID === movie.imdbID);
            if(idx !== -1) currentMovies[idx] = details;
            
            const ratingEl = document.getElementById(`rating-${movie.imdbID}`);
            if(ratingEl && details.imdbRating !== "N/A") {
                ratingEl.innerHTML = `<i class="fas fa-star"></i> ${details.imdbRating}`;
            }
        } catch(e) {}
    }
}

// --- RENDER LOGIC ---
function renderMovies(movies, isWatchlistRender = false, append = false) {
    if (!append && !isWatchlistRender) movieGrid.innerHTML = '';

    // Staggered animation delay calculation
    let delay = 0;

    movies.forEach(movie => {
        const isLiked = watchlist.some(m => m.imdbID === movie.imdbID);
        const heartClass = isLiked ? 'liked' : '';
        const heartIcon = isLiked ? 'fas fa-heart' : 'far fa-heart';
        const poster = (movie.Poster && movie.Poster !== 'N/A') ? movie.Poster : 'https://placehold.co/300x450/111/FFF?text=No+Poster';

        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.animationDelay = `${delay}s`; // Stagger animation
        delay += 0.05; // Increment delay

        card.innerHTML = `
            <div class="like-btn ${heartClass}" title="Add to Watchlist">
                <i class="${heartIcon}"></i>
            </div>
            <div class="poster-container">
                <img src="${poster}" alt="${movie.Title}" loading="lazy">
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

        card.querySelector('.like-btn').addEventListener('click', (e) => toggleHeart(e, movie));
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.like-btn')) openModal(movie);
        });

        movieGrid.appendChild(card);
    });
}

// --- WATCHLIST ---
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
        watchlistBtn.innerHTML = `<i class="fas fa-arrow-left"></i> <span class="btn-text">Back</span>`;
        sortSelect.disabled = true;
    } else {
        watchlistBtn.classList.remove('active');
        watchlistBtn.innerHTML = `<i class="fas fa-heart"></i> <span class="btn-text">Watchlist</span>`;
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
        movieGrid.innerHTML = `<div style="text-align:center; color:#777; width:100%; grid-column: 1/-1; padding: 50px;">
            <i class="far fa-heart" style="font-size: 3rem; margin-bottom:15px; opacity:0.5;"></i>
            <p>Your watchlist is empty.</p>
        </div>`;
        return;
    }
    renderMovies(watchlist, true);
}

// --- MODAL ---
async function openModal(movie) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Stop background scrolling
    modalBody.innerHTML = `<div class="loader-wave" style="margin: 50px auto;"><span></span><span></span><span></span><span></span><span></span></div>`;

    let fullMovie = movie;
    if (!movie.Plot || !movie.Genre) {
        try {
            const res = await fetch(`https://www.omdbapi.com/?i=${movie.imdbID}&apikey=${API_KEY}`);
            fullMovie = await res.json();
        } catch (e) {}
    }

    const poster = (fullMovie.Poster !== 'N/A') ? fullMovie.Poster : 'https://placehold.co/300x450';
    const trailerLink = `https://www.youtube.com/results?search_query=${fullMovie.Title}+${fullMovie.Year}+trailer`;
    const userNote = getUserNote(fullMovie.imdbID);

    modalBody.innerHTML = `
        <img src="${poster}" class="modal-poster">
        <div class="modal-text">
            <h2 style="color:white; font-size:2.5rem; line-height:1.1; margin-bottom:10px;">${fullMovie.Title}</h2>
            <div style="color:#a0a0a0; margin-bottom:20px; font-size: 0.95rem;">
                <span style="border:1px solid #444; padding:2px 6px; border-radius:4px;">${fullMovie.Rated}</span>
                <span style="margin: 0 10px;">•</span> ${fullMovie.Year} 
                <span style="margin: 0 10px;">•</span> ${fullMovie.Runtime}
            </div>
            
            <div style="margin-bottom:25px; display:flex; flex-wrap:wrap; gap:8px;">
                ${(fullMovie.Genre||'').split(',').map(g => 
                    `<span style="background:rgba(255,255,255,0.1); color:var(--primary); padding:6px 14px; border-radius:20px; font-size:0.85rem; font-weight:600;">${g.trim()}</span>`
                ).join('')}
            </div>

            <p style="color:#ddd; line-height:1.7; margin-bottom:25px; font-size:1.05rem;">${fullMovie.Plot}</p>
            
            <div style="display:grid; grid-template-columns: auto 1fr; gap: 10px 20px; margin-bottom: 25px; font-size:0.95rem;">
                <span style="color:var(--secondary); font-weight:bold;">Director</span> <span>${fullMovie.Director}</span>
                <span style="color:var(--secondary); font-weight:bold;">Cast</span> <span>${fullMovie.Actors}</span>
                <span style="color:var(--secondary); font-weight:bold;">IMDb</span> <span style="color:#ffd700;">⭐ ${fullMovie.imdbRating}</span>
            </div>
            
            <div class="user-actions">
                <h3 style="color:white; font-size:1.1rem; margin-bottom:10px;">Your Private Notes</h3>
                <textarea id="userNoteInput" class="note-input" rows="3" placeholder="What did you think?">${userNote}</textarea>
                <div class="action-btn-group">
                    <a href="${trailerLink}" target="_blank" class="trailer-btn"><i class="fab fa-youtube"></i> Watch Trailer</a>
                    <button id="shareBtn" class="share-btn"><i class="fas fa-share-alt"></i> Share</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('userNoteInput').addEventListener('input', (e) => saveUserNote(fullMovie.imdbID, e.target.value));
    document.getElementById('shareBtn').addEventListener('click', () => shareMovie(fullMovie.Title, fullMovie.Year, fullMovie.imdbID));
}

function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto'; // Restore scrolling
}

// --- UTILS & NEW FEATURES ---

function saveUserNote(id, text) {
    let notes = JSON.parse(localStorage.getItem('movieNotes')) || {};
    notes[id] = text;
    localStorage.setItem('movieNotes', JSON.stringify(notes));
}
function getUserNote(id) {
    return (JSON.parse(localStorage.getItem('movieNotes')) || {})[id] || "";
}

function shareMovie(t, y, id) {
    const text = `Check out "${t}" (${y})! https://www.imdb.com/title/${id}/`;
    navigator.clipboard.writeText(text).then(() => {
        showToast("Link copied to clipboard!");
    });
}

// NEW: Toast Notification System
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i> ${message}`;
    
    container.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function loadFeaturedMovies() {
    handleNewSearch("Avengers"); // Start with a bang
}

function showError(msg) {
    errorMsg.innerText = msg;
    errorMsg.classList.remove('hidden');
}

function handleSort() {
    const criteria = sortSelect.value;
    let sorted = [...currentMovies];
    
    if (criteria === 'year_desc') sorted.sort((a, b) => parseInt(b.Year) - parseInt(a.Year));
    if (criteria === 'year_asc') sorted.sort((a, b) => parseInt(a.Year) - parseInt(b.Year));
    if (criteria === 'rating_desc') sorted.sort((a, b) => parseFloat(b.imdbRating||0) - parseFloat(a.imdbRating||0));
    
    renderMovies(sorted);
}

// --- SURPRISE ME (Updated Visuals) ---
function triggerSurprise() {
    const curatedHits = [
        "Inception", "Interstellar", "The Dark Knight", "Everything Everywhere All At Once", 
        "Spider-Man: Into the Spider-Verse", "The Matrix", "Pulp Fiction", "Dune", "Blade Runner 2049",
        "Mad Max: Fury Road", "Parasite", "Get Out", "The Grand Budapest Hotel"
    ];

    const btnIcon = document.querySelector('.fab-circle i');
    btnIcon.className = "fas fa-spinner fa-spin"; // Spin icon

    setTimeout(() => {
        const randomPick = curatedHits[Math.floor(Math.random() * curatedHits.length)];
        searchInput.value = randomPick;
        handleNewSearch(randomPick);
        btnIcon.className = "fas fa-magic"; // Reset icon
        showToast(`Surprise! Showing results for: ${randomPick}`);
    }, 800);
}