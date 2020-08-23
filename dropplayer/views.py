from django.shortcuts import render
from django.http import HttpResponse
import os, glob
from .forms import MusicUpload, saveNewSong
# Create your views here.
def get_song_list():
    """
    Returns a list of the names of all the songs present in the static/dropplayer/songs folder
    """
    #for changing directory to the directory of this python script
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    #list which will contain the names of all the files
    namelist = []
    for files in (glob.glob('./static/dropplayer/songs/*.mp3')):
        filename = "/static/dropplayer/songs/"+str(files[26:]) #26 cz I had to trim away all the path text that was preceding it.
        namelist.append(filename)
    return namelist

def index(request):
    """
    Renders DropTune homepage
    """
    return render(request, 'dropplayer/index.html')

def player(request):
    """
    Renders the music player page
    """
    #list of the names of all the songs
    song_list = get_song_list()
    return render(request, 'dropplayer/player.html', {'songlist': song_list})

def dj(request):
    """
    Renders and manages the uploaded song of the DJ page
    """
    if request.method == "POST":
        form = MusicUpload(request.POST, request.FILES)
        if form.is_valid():
            saveNewSong(request.FILES['newsong'])
            return render(request, 'dropplayer/dj.html', {'musicform':form})
    else:
        form = MusicUpload()
    return render(request, 'dropplayer/dj.html', {'musicform':form})