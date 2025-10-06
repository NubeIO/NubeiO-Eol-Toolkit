#!/usr/bin/env python3
import paho.mqtt.client as mqtt
import json
import time
import random
import sys

BROKER = "113.160.225.31"
PORT = 1883

def create_virtual_device(device_id):
    """Simulate a virtual ESP32 device"""
    client = mqtt.Client(client_id=f"virtual_{device_id}")
    
    def on_connect(client, userdata, flags, rc):
        print(f"✓ {device_id} connected to broker (rc: {rc})")
        # Subscribe to control topic
        client.subscribe(f"ac_sim/{device_id}/control")
        # Publish discovery
        discovery = {
            "deviceId": device_id,
            "model": 1,
            "modelName": "Office Model",
            "ip": f"192.168.1.{random.randint(100,200)}",
            "firmware_version": "1.0.0"
        }
        client.publish("ac_sim/discovery", json.dumps(discovery), qos=1)
        print(f"✓ {device_id} published discovery")
    
    def on_message(client, userdata, msg):
        """Handle control commands"""
        try:
            data = json.loads(msg.payload.decode())
            action = data.get('action')
            value = data.get('value')
            print(f"  {device_id} received: {action} = {value}")
            
            # Update device state based on command
            if action == 'power':
                userdata['state']['power'] = value
            elif action == 'mode' or action == 'set_mode':
                userdata['state']['mode'] = value.capitalize() if isinstance(value, str) else ['Auto', 'Cool', 'Dry', 'Fan', 'Heat'][value]
            elif action == 'temperature' or action == 'set_target_temp':
                userdata['state']['temperature'] = value
            elif action == 'fanSpeed' or action == 'set_fan_speed':
                if isinstance(value, str):
                    userdata['state']['fanSpeed'] = value.capitalize()
                else:
                    fan_map = {0: 'Auto', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Quiet'}
                    userdata['state']['fanSpeed'] = fan_map.get(value, 'Auto')
            elif action == 'roomTemperature' or action == 'currentTemp':
                userdata['state']['currentTemp'] = value
            
            # Publish updated state immediately
            publish_state(client, device_id, userdata['state'])
        except Exception as e:
            print(f"  {device_id} error: {e}")
    
    client.on_connect = on_connect
    client.on_message = on_message
    
    # Initial state
    client.user_data_set({
        'state': {
            'power': False,
            'mode': 'Cool',
            'temperature': random.randint(20, 26),
            'fanSpeed': random.choice(['Auto', 'Low', 'Medium', 'High', 'Quiet']),
            'swing': False,
            'currentTemp': round(random.uniform(22.0, 28.0), 1),
            'model': 1
        }
    })
    
    return client

def publish_state(client, device_id, state):
    """Publish device state"""
    message = {
        'timestamp': int(time.time() * 1000),
        'deviceId': device_id,
        'data': state
    }
    # Publish to device-specific and broadcast topics
    client.publish(f"ac_sim/{device_id}/state", json.dumps(message), qos=1)
    client.publish("ac_sim/broadcast/state", json.dumps(message), qos=1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 simulate_devices.py <number_of_devices>")
        print("Example: python3 simulate_devices.py 3")
        sys.exit(1)
    
    num_devices = int(sys.argv[1])
    print(f"\n🚀 Starting {num_devices} virtual ESP32 devices...\n")
    
    devices = []
    for i in range(num_devices):
        # Generate 8-character hex ID from last 4 bytes of MAC (like 01C006D0)
        device_id = f"AC_SIM_{random.randint(0x01000000, 0xFFFFFFFF):08X}"
        client = create_virtual_device(device_id)
        devices.append((device_id, client))
    
    # Connect all devices
    for device_id, client in devices:
        try:
            client.connect(BROKER, PORT, 60)
            client.loop_start()
        except Exception as e:
            print(f"✗ Failed to connect {device_id}: {e}")
    
    print(f"\n✅ All devices connected! Publishing state every 5 seconds...\n")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            for device_id, client in devices:
                state = client._userdata['state']
                publish_state(client, device_id, state)
            time.sleep(5)
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping all devices...")
        for _, client in devices:
            client.loop_stop()
            client.disconnect()
        print("✓ Done\n")

if __name__ == "__main__":
    main()
