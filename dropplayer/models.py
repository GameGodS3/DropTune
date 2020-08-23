from django.db import models
import os

# Create your models here.
class MusicHandle(models.Model):
    newsong = models.FileField(upload_to='.')