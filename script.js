// Import Library Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } 
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ------------------------------------------------------------------
// ⚠️ PASTE KODE CONFIG FIREBASE ANDA DI SINI (GANTI YANG INI)
// ------------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyAPOKCRgpRsXorlb1H3dgYI1beQazLlyeM",
    authDomain: "my-time-tracker-az2104.firebaseapp.com",
    projectId: "my-time-tracker-az2104",
    storageBucket: "my-time-tracker-az2104.firebasestorage.app",
    messagingSenderId: "433116282352",
    appId: "1:433116282352:web:428fef9f65ccc7e014b135",
    measurementId: "G-SL0FFM6PK9"
};
// ------------------------------------------------------------------

// Inisialisasi
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let startTime;
let timerInterval;
let currentUser = null;

// Variabel untuk menyimpan input user sementara
let currentTaskName = "";
let currentCategory = "";

// LOGIKA LOGIN
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('userName').innerText = user.displayName;
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        loadLogs(user.uid);
    } else {
        currentUser = null;
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
    }
});

document.getElementById('btnLogin').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => alert(error.message));
});

document.getElementById('btnLogout').addEventListener('click', () => {
    if(confirm("Yakin ingin keluar?")) signOut(auth);
});

// --- LOGIKA TIMER ---

document.getElementById('btnStart').addEventListener('click', () => {
    // 1. Ambil nilai dari input
    const taskInput = document.getElementById('taskInput');
    const categoryInput = document.getElementById('categoryInput');
    
    // 2. Validasi: Tidak boleh kosong
    if (taskInput.value.trim() === "") {
        alert("Mohon isi nama kegiatan dulu!");
        taskInput.focus();
        return;
    }

    // 3. Simpan ke variabel dan kunci input (biar gak diganti pas timer jalan)
    currentTaskName = taskInput.value;
    currentCategory = categoryInput.value;
    taskInput.disabled = true;
    categoryInput.disabled = true;

    startTime = Date.now();
    document.getElementById('btnStart').classList.add('hidden');
    document.getElementById('btnStop').classList.remove('hidden');
    document.getElementById('statusText').innerText = `Sedang mengerjakan: ${currentTaskName}... 🔥`;
    document.getElementById('statusText').classList.add('text-success');

    timerInterval = setInterval(() => {
        const diff = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        document.getElementById('timer').innerText = `${h}:${m}:${s}`;
    }, 1000);
});

document.getElementById('btnStop').addEventListener('click', async () => {
    clearInterval(timerInterval);
    const endTime = Date.now();
    const durationSec = Math.floor((endTime - startTime) / 1000);

    // Reset UI
    document.getElementById('btnStop').classList.add('hidden');
    document.getElementById('btnStart').classList.remove('hidden');
    document.getElementById('timer').innerText = "00:00:00";
    document.getElementById('statusText').innerText = "Kegiatan tersimpan! ✅";
    document.getElementById('statusText').classList.remove('text-success');
    
    // Buka kunci input dan kosongkan
    const taskInput = document.getElementById('taskInput');
    const categoryInput = document.getElementById('categoryInput');
    taskInput.disabled = false;
    categoryInput.disabled = false;
    taskInput.value = ""; // Kosongkan biar siap buat tugas baru

    if (currentUser) {
        try {
            await addDoc(collection(db, "logs"), {
                uid: currentUser.uid,
                task: currentTaskName,       // Simpan Nama Kegiatan
                category: currentCategory,   // Simpan Kategori
                start: new Date(startTime).toLocaleString(),
                end: new Date(endTime).toLocaleString(),
                duration: durationSec,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Error:", e);
            alert("Gagal menyimpan data.");
        }
    }
});

// LOGIKA LOAD DATA
function loadLogs(userId) {
    const q = query(collection(db, "logs"), where("uid", "==", userId), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('logBody');
        tbody.innerHTML = '';
        
        if (snapshot.empty) tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada data.</td></tr>';
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            const h = Math.floor(data.duration / 3600).toString().padStart(2, '0');
            const m = Math.floor((data.duration % 3600) / 60).toString().padStart(2, '0');
            const s = (data.duration % 60).toString().padStart(2, '0');
            
            const dateOnly = data.start.split(',')[0]; 
            const timeStart = data.start.split(',')[1] || data.start;
            const timeEnd = data.end.split(',')[1] || data.end;

            // Handle data lama yang mungkin belum punya field 'task' atau 'category'
            const taskDisplay = data.task || "-";
            const categoryDisplay = data.category || "Umum";

            // Warna badge kategori
            let badgeColor = "bg-secondary";
            if(categoryDisplay === "Coding") badgeColor = "bg-primary";
            if(categoryDisplay === "Belajar") badgeColor = "bg-success";
            if(categoryDisplay === "Meeting") badgeColor = "bg-warning text-dark";

            tbody.innerHTML += `<tr>
                <td><small>${dateOnly}</small></td>
                <td class="fw-bold">${taskDisplay}</td>
                <td><span class="badge ${badgeColor}">${categoryDisplay}</span></td>
                <td><small>${timeStart} - ${timeEnd}</small></td>
                <td>${h}:${m}:${s}</td>
            </tr>`;
        });
    });
}