from django.shortcuts import render
from django.http import HttpResponse
import os, glob
# Create your views here.
def get_song_list():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    namelist = []
    for files in (glob.glob('./static/dropplayer/songs/*.mp3')):
        filename = "/static/dropplayer/songs/"+str(files[26:])
        namelist.append(filename)
    return namelist

def index(request):
    song_list = get_song_list()
    return render(request, 'dropplayer/index.html', {'songlist': song_list})