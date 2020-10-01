from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('player', views.player, name='player'),
    path('dj', views.dj, name='dj'),
    path('loading', views.loading, name='loading'),
]