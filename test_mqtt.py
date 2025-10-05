#!/usr/bin/env python3
"""
MQTT Test Script for FGA Simulator
Tests MQTT communication with the air conditioner simulator
"""

import json
import time
import paho.mqtt.client as mqtt
import threading

class MQTTTester:
    def __init__(self, broker="localhost", port=1883):
        self.broker = broker
        self.port = port
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.connected = False
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Connected to MQTT broker")
            self.connected = True
            # Subscribe to all relevant topics
            client.subscribe("ac_sim/+/state")
            client.subscribe("ac_sim/+/control")
            client.subscribe("ac_sim/+/uart/+")
            client.subscribe("ac_sim/discovery")
            print("📡 Subscribed to all AC simulator topics")
        else:
            print(f"❌ Failed to connect to MQTT broker: {rc}")
            
    def on_message(self, client, userdata, msg):
        topic = msg.topic
        try:
            payload = json.loads(msg.payload.decode())
            print(f"📨 Received on {topic}:")
            print(f"   {json.dumps(payload, indent=2)}")
        except json.JSONDecodeError:
            print(f"📨 Received on {topic}: {msg.payload.decode()}")
            
    def connect(self):
        try:
            self.client.connect(self.broker, self.port, 60)
            self.client.loop_start()
            return True
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False
            
    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()
        
    def send_control_command(self, device_id, command, value):
        """Send a control command to the simulator"""
        topic = f"ac_sim/{device_id}/control"
        message = {
            "command": command,
            "value": value
        }
        result = self.client.publish(topic, json.dumps(message))
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"📤 Sent control command: {command} = {value}")
        else:
            print(f"❌ Failed to send command: {result.rc}")
            
    def send_broadcast_command(self, command, value):
        """Send a broadcast control command"""
        topic = "ac_sim/all/control"
        message = {
            "command": command,
            "value": value
        }
        result = self.client.publish(topic, json.dumps(message))
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"📤 Sent broadcast command: {command} = {value}")
        else:
            print(f"❌ Failed to send broadcast command: {result.rc}")

def main():
    print("🧪 FGA Simulator MQTT Test")
    print("=" * 40)
    
    # Connect to MQTT broker
    tester = MQTTTester()
    if not tester.connect():
        print("❌ Could not connect to MQTT broker")
        print("   Make sure Mosquitto or another MQTT broker is running")
        return
        
    # Wait for connection
    time.sleep(2)
    
    if not tester.connected:
        print("❌ Not connected to MQTT broker")
        return
        
    print("\n🎮 Testing Air Conditioner Controls")
    print("-" * 40)
    
    # Test device ID (you may need to adjust this)
    device_id = "ac_sim_001"  # Change this to match your device ID
    
    try:
        # Test power control
        print("\n1. Testing Power Control")
        tester.send_control_command(device_id, "power", True)
        time.sleep(1)
        tester.send_control_command(device_id, "power", False)
        time.sleep(1)
        
        # Test mode control
        print("\n2. Testing Mode Control")
        modes = ["Auto", "Cool", "Dry", "Fan", "Heat"]
        for mode in modes:
            tester.send_control_command(device_id, "mode", mode)
            time.sleep(0.5)
            
        # Test temperature control
        print("\n3. Testing Temperature Control")
        temperatures = [18.0, 20.0, 22.0, 24.0, 26.0]
        for temp in temperatures:
            tester.send_control_command(device_id, "temperature", temp)
            time.sleep(0.5)
            
        # Test fan speed control
        print("\n4. Testing Fan Speed Control")
        fan_speeds = ["Auto", "Quiet", "Low", "Medium", "High"]
        for speed in fan_speeds:
            tester.send_control_command(device_id, "fanSpeed", speed)
            time.sleep(0.5)
            
        # Test swing control
        print("\n5. Testing Swing Control")
        tester.send_control_command(device_id, "swing", True)
        time.sleep(1)
        tester.send_control_command(device_id, "swing", False)
        time.sleep(1)
        
        # Test room temperature
        print("\n6. Testing Room Temperature")
        room_temps = [20, 22, 24, 26, 28]
        for temp in room_temps:
            tester.send_control_command(device_id, "roomTemperature", temp)
            time.sleep(0.5)
            
        # Test model change
        print("\n7. Testing Model Change")
        models = [1, 2, 3]  # Office, Horizontal, VRF
        for model in models:
            tester.send_control_command(device_id, "model", model)
            time.sleep(1)
            
        # Test broadcast commands
        print("\n8. Testing Broadcast Commands")
        tester.send_broadcast_command("power", True)
        time.sleep(1)
        tester.send_broadcast_command("mode", "Cool")
        time.sleep(1)
        
        print("\n✅ All tests completed!")
        print("   Check the FGA Simulator application to see the changes")
        print("   Monitor the console output for MQTT messages")
        
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test error: {e}")
    finally:
        tester.disconnect()
        print("\n👋 Disconnected from MQTT broker")

if __name__ == "__main__":
    main()
