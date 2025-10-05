export namespace main {
	
	export class AirConditioner {
	    power: boolean;
	    mode: string;
	    temperature: number;
	    fanSpeed: string;
	    swing: boolean;
	    currentTemp: number;
	    model: number;
	
	    static createFrom(source: any = {}) {
	        return new AirConditioner(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.power = source["power"];
	        this.mode = source["mode"];
	        this.temperature = source["temperature"];
	        this.fanSpeed = source["fanSpeed"];
	        this.swing = source["swing"];
	        this.currentTemp = source["currentTemp"];
	        this.model = source["model"];
	    }
	}
	export class CapabilityInfo {
	    model: number;
	    modelName: string;
	    systemType: number;
	    verticalSteps: number;
	    verticalSwing: boolean;
	    verticalVaneCount: number;
	    verticalVaneSupported: boolean[];
	    horizontalSteps: number;
	    horizontalSwing: boolean;
	    horizontalVaneCount: number;
	    horizontalVaneSupported: boolean[];
	
	    static createFrom(source: any = {}) {
	        return new CapabilityInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.modelName = source["modelName"];
	        this.systemType = source["systemType"];
	        this.verticalSteps = source["verticalSteps"];
	        this.verticalSwing = source["verticalSwing"];
	        this.verticalVaneCount = source["verticalVaneCount"];
	        this.verticalVaneSupported = source["verticalVaneSupported"];
	        this.horizontalSteps = source["horizontalSteps"];
	        this.horizontalSwing = source["horizontalSwing"];
	        this.horizontalVaneCount = source["horizontalVaneCount"];
	        this.horizontalVaneSupported = source["horizontalVaneSupported"];
	    }
	}
	export class DiscoveredDevice {
	    deviceId: string;
	    // Go type: time
	    lastSeen: any;
	    ipAddress?: string;
	    firmwareVersion?: string;
	    state?: AirConditioner;
	
	    static createFrom(source: any = {}) {
	        return new DiscoveredDevice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.deviceId = source["deviceId"];
	        this.lastSeen = this.convertValues(source["lastSeen"], null);
	        this.ipAddress = source["ipAddress"];
	        this.firmwareVersion = source["firmwareVersion"];
	        this.state = this.convertValues(source["state"], AirConditioner);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MQTTConfig {
	    broker: string;
	    port: number;
	    username: string;
	    password: string;
	    clientId: string;
	    deviceId: string;
	
	    static createFrom(source: any = {}) {
	        return new MQTTConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.broker = source["broker"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.clientId = source["clientId"];
	        this.deviceId = source["deviceId"];
	    }
	}

}

