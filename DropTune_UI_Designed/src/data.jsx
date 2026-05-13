/* global window */

// Peers in the room. peer 0 = "you" (this device).
const PEERS = [
  { id: 'p0', name: 'Rohan\'s Laptop', short: 'RL', colorIdx: 0, isYou: true,  device: 'macbook', online: true },
  { id: 'p1', name: 'Priya\'s iPhone',  short: 'PI', colorIdx: 1, isYou: false, device: 'phone',   online: true },
  { id: 'p2', name: 'Kitchen Speaker',  short: 'KS', colorIdx: 2, isYou: false, device: 'speaker', online: true },
  { id: 'p3', name: 'Arjun\'s Pixel',   short: 'AP', colorIdx: 3, isYou: false, device: 'phone',   online: true },
  { id: 'p4', name: 'Studio iMac',      short: 'SI', colorIdx: 4, isYou: false, device: 'desktop', online: false },
];

const NEARBY_ROOMS = [
  { id: 'r1', name: 'Living Room',     participants: 4, host: 'p2', lastActive: 'now' },
  { id: 'r2', name: 'Saturday Session', participants: 7, host: 'p1', lastActive: '2m ago' },
  { id: 'r3', name: 'Studio',           participants: 2, host: 'p4', lastActive: '12m ago' },
];

// Folders the user has indexed locally.
const INDEXED_FOLDERS = [
  { id: 'f1', name: '~/Music/Sonet USB playlist', tracks: 218, size: '1.4 GB' },
  { id: 'f2', name: '~/Music/Tamil Classics',     tracks: 142, size: '912 MB' },
  { id: 'f3', name: '~/Downloads/Synth',          tracks:  95, size: '548 MB' },
];

// Tracks. Spread across peers; "you" have most but not all.
const T = (id, title, artist, album, sec, sizeMB, fmt, owners, gradIdx) => ({
  id, title, artist, album, durationSec: sec, sizeMB, format: fmt,
  owners, // array of peer ids that have this file locally
  gradIdx: gradIdx ?? (id.charCodeAt(2) + id.length) % 10,
});

const TRACKS = [
  T('t01', 'Pee loon',          'Mohit Chauhan',     'Once Upon a Time in Mumbaai', 326, 7.6, 'mp3', ['p0', 'p1']),
  T('t02', 'En Jeevan',         'Anirudh Ravichander','Theri',                       287, 6.8, 'mp3', ['p0']),
  T('t03', 'Iruvar - Narumugaiye', 'A. R. Rahman',   'Iruvar',                       301, 7.1, 'mp3', ['p0', 'p3']),
  T('t04', 'Chembakame',        'Vidyasagar',         'Meesa Madhavan',              224, 5.3, 'mp3', ['p0', 'p4']),
  T('t05', 'Kayal - Kanni Olangal','D. Imman',        'Kayal',                       265, 6.2, 'mp3', ['p0']),
  T('t06', 'Tum Hi Ho',         'Arijit Singh',       'Aashiqui 2',                  256, 6.0, 'mp3', ['p1']),
  T('t07', 'Vaathi Coming',     'Anirudh Ravichander','Master',                      198, 4.7, 'mp3', ['p3', 'p1']),
  T('t08', 'Munbe Vaa',         'Shreya Ghoshal',     'Sillunu Oru Kaadhal',         312, 7.4, 'mp3', ['p0', 'p2']),
  T('t09', 'Channa Mereya',     'Arijit Singh',       'Ae Dil Hai Mushkil',          287, 6.8, 'mp3', ['p1', 'p2']),
  T('t10', 'Nira',              'Sid Sriram',         'Ek Kadhal Kanmani',           254, 6.1, 'flac', ['p4'], 4),
  T('t11', 'Soul of Tamizh',    'A. R. Rahman',       'Kaatru Veliyidai',            134, 3.2, 'mp3', ['p0', 'p1', 'p3']),
  T('t12', 'Saturday Night',    'Khalid',             'Free Spirit',                 199, 4.6, 'mp3', ['p1']),
  T('t13', 'Daydreamer',        'Adele',              '19',                          213, 5.0, 'mp3', ['p0']),
  T('t14', 'Pink + White',      'Frank Ocean',        'Blonde',                      184, 4.4, 'flac', ['p4'], 8),
  T('t15', 'Sunflower',         'Post Malone',        'Spider-Verse',                158, 3.8, 'mp3', ['p1', 'p3']),
  T('t16', 'Khairiyat',         'Arijit Singh',       'Chhichhore',                  299, 7.1, 'mp3', ['p0', 'p1']),
  T('t17', 'Anbe Sivam',        'Vidyasagar',         'Anbe Sivam',                  342, 8.1, 'mp3', ['p0']),
  T('t18', 'Kandukondain',      'A. R. Rahman',       'Kandukondain',                311, 7.4, 'mp3', ['p0', 'p4']),
  T('t19', 'Maara - Theme',     'Ghibran',            'Maara',                       198, 4.7, 'flac',['p4'], 2),
  T('t20', 'Mungaru Male',      'Mano Murthy',        'Mungaru Male',                284, 6.8, 'mp3', ['p3']),
  T('t21', 'Vellipomakey',      'Sid Sriram',         'Sahasam Swasaga',             276, 6.5, 'mp3', ['p1', 'p3']),
  T('t22', 'Inkem Inkem',       'Sid Sriram',         'Geetha Govindam',             254, 6.1, 'mp3', ['p0', 'p1']),
  T('t23', 'Naane Varuvean',    'Bombay Jayashri',    'Naane Varuvean',              278, 6.6, 'mp3', ['p3']),
  T('t24', 'Ennodu Nee Irundhal','A.R. Rahman',       'I',                           302, 7.2, 'mp3', ['p0', 'p2']),
  T('t25', 'Kanave',            'Anirudh',            'David',                       223, 5.3, 'mp3', ['p0', 'p3']),
  T('t26', 'Theera Ulaa',       'Anirudh',            'Master',                      245, 5.8, 'mp3', ['p0']),
  T('t27', 'Maruvaarthai',      'Sid Sriram',         'Enai Noki Paayum Thota',      264, 6.3, 'flac',['p4'], 6),
  T('t28', 'Vinmeen Vithaiyil', 'Shreya Ghoshal',     'Thegidi',                     287, 6.8, 'mp3', ['p1', 'p2']),
  T('t29', 'Ottagathai Kattiko','Shankar Mahadevan',  'Gentleman',                   245, 5.8, 'mp3', ['p0']),
  T('t30', 'Chuttamalle',       'Anirudh',            'Devara',                      198, 4.7, 'mp3', ['p1', 'p3']),
];

// Initial queue. First item is "now playing", rest are upcoming.
const INITIAL_QUEUE = [
  { id: 'q1', trackId: 't02', addedBy: 'p0' },   // En Jeevan (playing)
  { id: 'q2', trackId: 't08', addedBy: 'p1' },   // Munbe Vaa
  { id: 'q3', trackId: 't10', addedBy: 'p3' },   // Nira (remote, FLAC)
  { id: 'q4', trackId: 't22', addedBy: 'p1' },   // Inkem Inkem
  { id: 'q5', trackId: 't14', addedBy: 'p4' },   // Pink + White (remote)
];

// Initial playback state (would be coordinator state in real app).
const INITIAL_PLAYBACK = {
  status: 'playing',     // playing | paused
  positionSec: 78,       // current scrub position
  hostPeerId: 'p2',      // Kitchen Speaker is host
  shuffle: false,
  repeat: 'off',
};

const ROOM_INFO = {
  id: 'r1',
  name: 'Living Room',
  hostIP: '192.168.1.42',
  port: 8787,
  createdAt: Date.now() - 1000 * 60 * 22,
};

// Helpers
function fmtTime(sec) {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function peerById(id) {
  return PEERS.find((p) => p.id === id);
}

function trackById(id) {
  return TRACKS.find((t) => t.id === id);
}

function isLocalToYou(track) {
  return track && track.owners.includes('p0');
}

// Active simulated transfers (peer → host, for tracks not local to host)
const INITIAL_TRANSFERS = [
  // q3 = Nira from p4 → host, mid-download
  { trackId: 't10', sourcePeerId: 'p4', progress: 47, status: 'downloading' },
];

Object.assign(window, {
  PEERS, NEARBY_ROOMS, INDEXED_FOLDERS, TRACKS,
  INITIAL_QUEUE, INITIAL_PLAYBACK, ROOM_INFO, INITIAL_TRANSFERS,
  fmtTime, peerById, trackById, isLocalToYou
});
