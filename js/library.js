// Kanye West discography
// NetEase song IDs for outchain player: music.163.com/outchain/player?type=2&id={neId}&auto=1&height=66
// neId = 0 means "not yet looked up" — the track shows dimmed and won't play

const ALBUMS = [
  {
    id: 0,
    title: 'The College Dropout',
    year: 2004,
    color: '#c49060',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/24/4e/19/244e19a8-8a6d-3f6b-1e8d-9e6a1c9c3f0b/0602567880882.jpg/600x600bb.jpg',
    tracks: [
      { title: 'We Don\'t Care', neId: 0 },
      { title: 'All Falls Down', neId: 5046362 },
      { title: 'Jesus Walks', neId: 5046865 },
      { title: 'Through the Wire', neId: 5046867 },
      { title: 'Slow Jamz', neId: 5046869 },
      { title: 'Family Business', neId: 0 },
      { title: 'Last Call', neId: 0 }
    ]
  },
  {
    id: 1,
    title: 'Late Registration',
    year: 2005,
    color: '#d4a853',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8a/6d/3f/8a6d3f8a-9c6d-4b1e-8d3f-9e6a1c9c3f0b/0602567880882.jpg/600x600bb.jpg',
    tracks: [
      { title: 'Touch the Sky', neId: 5046871 },
      { title: 'Gold Digger', neId: 5046867 },
      { title: 'Drive Slow', neId: 0 },
      { title: 'Diamonds from Sierra Leone', neId: 5046875 },
      { title: 'Hey Mama', neId: 5046877 },
      { title: 'Roses', neId: 0 },
      { title: 'Gone', neId: 0 }
    ]
  },
  {
    id: 2,
    title: 'Graduation',
    year: 2007,
    color: '#e74c8a',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/9a/6d/3f/9a6d3f8a-9c6d-4b1e-8d3f-9e6a1c9c3f0b/0602567880882.jpg/600x600bb.jpg',
    tracks: [
      { title: 'Stronger', neId: 34160056 },
      { title: 'Good Life', neId: 5046881 },
      { title: 'Can\'t Tell Me Nothing', neId: 5046883 },
      { title: 'Flashing Lights', neId: 5046885 },
      { title: 'Homecoming', neId: 5046887 },
      { title: 'Everything I Am', neId: 0 },
      { title: 'Big Brother', neId: 0 }
    ]
  },
  {
    id: 3,
    title: '808s & Heartbreak',
    year: 2008,
    color: '#9b8ec4',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/8a/6d/3f/8a6d3f8a-9c6d-4b1e-8d3f-9e6a1c9c3f0b/0602567880882.jpg/600x600bb.jpg',
    tracks: [
      { title: 'Heartless', neId: 1870033 },
      { title: 'Love Lockdown', neId: 1870035 },
      { title: 'Amazing', neId: 1870037 },
      { title: 'Paranoid', neId: 0 },
      { title: 'Coldest Winter', neId: 0 },
      { title: 'Welcome to Heartbreak', neId: 0 },
      { title: 'Say You Will', neId: 0 }
    ]
  },
  {
    id: 4,
    title: 'My Beautiful Dark\nTwisted Fantasy',
    year: 2010,
    color: '#c0392b',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8a/6d/3f/8a6d3f8a-9c6d-4b1e-8d3f-9e6a1c9c3f0b/0602567880882.jpg/600x600bb.jpg',
    tracks: [
      { title: 'Power', neId: 27969719 },
      { title: 'All of the Lights', neId: 27969830 },
      { title: 'Runaway', neId: 27969833 },
      { title: 'Monster', neId: 27969835 },
      { title: 'Dark Fantasy', neId: 27969838 },
      { title: 'Blame Game', neId: 0 },
      { title: 'Devil in a New Dress', neId: 0 }
    ]
  },
  {
    id: 5,
    title: 'Yeezus',
    year: 2013,
    color: '#e0e0e0',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/8a/6d/3f/8a6d3f8a-9c6d-4b1e-8d3f-9e6a1c9c3f0b/0602567880882.jpg/600x600bb.jpg',
    tracks: [
      { title: 'Black Skinhead', neId: 26443399 },
      { title: 'Bound 2', neId: 26443404 },
      { title: 'New Slaves', neId: 0 },
      { title: 'Blood on the Leaves', neId: 0 },
      { title: 'Hold My Liquor', neId: 0 },
      { title: 'I Am a God', neId: 0 },
      { title: 'On Sight', neId: 0 }
    ]
  },
  {
    id: 6,
    title: 'The Life of Pablo',
    year: 2016,
    color: '#e67e22',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8a/6d/3f/8a6d3f8a-9c6d-4b1e-8d3f-9e6a1c9c3f0b/0602567880882.jpg/600x600bb.jpg',
    tracks: [
      { title: 'Famous', neId: 41759670 },
      { title: 'Ultralight Beam', neId: 41759672 },
      { title: 'Father Stretch My Hands Pt. 1', neId: 41759674 },
      { title: 'Waves', neId: 0 },
      { title: 'FML', neId: 0 },
      { title: 'Real Friends', neId: 0 },
      { title: 'No More Parties in LA', neId: 0 }
    ]
  },
  {
    id: 7,
    title: 'ye',
    year: 2018,
    color: '#2ecc71',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8a/6d/3f/8a6d3f8a-9c6d-4b1e-8d3f-9e6a1c9c3f0b/0602567880882.jpg/600x600bb.jpg',
    tracks: [
      { title: 'Yikes', neId: 53834406 },
      { title: 'All Mine', neId: 0 },
      { title: 'Ghost Town', neId: 53834408 },
      { title: 'Violent Crimes', neId: 0 },
      { title: 'I Thought About Killing You', neId: 0 },
      { title: 'No Mistakes', neId: 0 },
      { title: 'Wouldn\'t Leave', neId: 0 }
    ]
  },
  {
    id: 8,
    title: 'Donda',
    year: 2021,
    color: '#1a1a1a',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8a/6d/3f/8a6d3f8a-9c6d-4b1e-8d3f-9e6a1c9c3f0b/0602567880882.jpg/600x600bb.jpg',
    tracks: [
      { title: 'Hurricane', neId: 1870054545 },
      { title: 'Jail', neId: 1870054547 },
      { title: 'Praise God', neId: 1870054549 },
      { title: 'Off the Grid', neId: 0 },
      { title: 'Moon', neId: 0 },
      { title: 'Believe What I Say', neId: 0 },
      { title: 'Come to Life', neId: 0 }
    ]
  }
];

export class Library {
  constructor() {
    this.albums = ALBUMS;
  }

  getAlbum(index) {
    return this.albums[index] || null;
  }

  getAllAlbums() {
    return this.albums;
  }

  getAlbumCount() {
    return this.albums.length;
  }

  getTrack(albumIndex, trackIndex) {
    const album = this.albums[albumIndex];
    if (!album) return null;
    return album.tracks[trackIndex] || null;
  }
}
