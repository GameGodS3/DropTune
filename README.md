# DropTune : Over-the-Air Music Player

*Ever wanted to play music in your TV or Music System that does not support over-the-air, but you are too lazy to write songs into a USB?*

Well, **DropTune** is your buddy here.

Upload songs from one device and have it played in another device.

##### "Inspiration"
###### I had a Raspberry Pi 2 Model A which had no Wi-Fi module but can connect to internet by using tethering from an old Nokia. But the internet was slow, and the Pi cannot handle quite heavy pieces of software. Hence, this.

## Synopsis
DropTune has two modes: DJ and Player, to drop a song for playback, and to play the dropped song, respectively.

![Program Screenshot](https://github.com/GameGodS3/DropTune/blob/master/screenshot.png?raw=true)

### Prerequisites

Requires python3 and pip3 installed in the Laptop/PC.

## Installation

Download this repo as zip and extract

OR

Clone using

```
git clone https://github.com/GameGodS3/DropTune.git
```
and
```
cd DropTune
```

Then
### For Linux
```bash
chmod +x ./install.sh
./install.sh
./launch.sh
```
### For Windows
```cmd
install.bat
launch.bat
```
Or double click on `install.bat` and then `launch.bat`

If you know how to access your laptop/PC's IP address and connect to the localhost using a mobile or other devices connected to the same network, you could better use the player.

More clear instructions on that part coming up.

---
---
## Troubleshooting
If the page doesn't load in your browser after 15-20 seconds, press reload

If it still doesn't, close the terminal that opened when you launched the `launch.bat` / `launch.sh`. 

Open a fresh terminal in the folder and type
##### For Linux
```
python3 manage.py runserver
```
##### For Windows
```
python manage.py runserver
```
And then try the URL that comes after it loads.