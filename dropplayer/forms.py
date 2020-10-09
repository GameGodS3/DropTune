from django import forms
from django.core.exceptions import ValidationError
import os

def saveNewSong(f):
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f)
    fname = str(f)
    if fname[-4:]!=".mp3":
        fname += ".mp3"
    staticdestination = "static/dropplayer/songs/"+fname
    with open(staticdestination, 'wb+') as song:
        song.write(f.read())

class MusicUpload(forms.Form):
    newsong = forms.FileField(widget=forms.ClearableFileInput(attrs={'style':'color:white', 'accept':'audio/mpeg', 'hidden':True}), label="")

class songComplete(forms.Form):
    complete = forms.CharField(label='', widget=forms.TextInput(attrs={'hidden':'', 'value':'ended'}))