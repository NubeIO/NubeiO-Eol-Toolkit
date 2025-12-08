# Brother Printer System Architecture

## Component Diagram

```mermaid
graph TB
    subgraph "Electron Main Process"
        A[main.js] --> B[IPC Handlers]
        B --> C[spawnPython Function]
        C --> D{Check .exe exists?}
        D -->|Yes| E[Spawn .exe]
        D -->|No| F[Spawn Python]
    end
    
    subgraph "Renderer Process"
        G[Factory Testing UI] --> H[IPC Invoke]
        H --> B
    end
    
    subgraph "Printer Module"
        E --> I[print_product_label.exe]
        F --> J[print_product_label.py]
        I --> K[Brother QL Library]
        J --> K
        K --> L[USB Backend]
        L --> M[libusb-1.0]
    end
    
    subgraph "Hardware"
        M --> N[Brother PT-P900W]
    end
    
    subgraph "Support Libraries"
        K --> O[PIL - Image Processing]
        K --> P[python-barcode]
        K --> Q[PyUSB]
    end
    
    style I fill:#90EE90
    style J fill:#FFB6C1
    style N fill:#87CEEB
