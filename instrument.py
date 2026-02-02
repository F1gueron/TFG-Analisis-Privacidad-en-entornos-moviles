import frida
from pathlib import Path

packageName = "com.gamovation.chessclubpilot"

def loadScript(session, file='_agent.js'):
    with open(file, 'r', encoding='utf8') as f:
        script_content = f.read()
        script = session.create_script(script_content)
        script.on("message", on_message)
        script.load()


def on_message(message, data):
    if message['type'] == 'send':
        print(f"{message['payload']}")
    elif message['type'] == 'error':
        print(f"{message['description']}")
    else:
        print(f"Unknown msg type: {message}")

def main():
    device = frida.get_usb_device()
    print(f"Found device!: {device}")
    pid = device.spawn([packageName])
    print(f"Spawned {pid}: {packageName}")
    session = device.attach(pid)
    print(f"Atacched to {pid}: {packageName}")
    loadScript(session)
    print(f"Script loaded, resuming session")
    device.resume(pid)
    
if __name__ == '__main__':
    main()
    input()
