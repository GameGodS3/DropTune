import socket, subprocess, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))


s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.connect(("8.8.8.8", 80))
ip = str(s.getsockname()[0])
s.close()

runningip = ip+":6969"

runner = subprocess.Popen(["python3", "manage.py", "runserver", runningip])
runner.wait()