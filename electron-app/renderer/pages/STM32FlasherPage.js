/**
 * STM32 Droplet Flasher Page
 */

class STM32FlasherPage {
    constructor() {
        this.module = window.stm32Flasher;
    }

    async init() {
        await this.module.init();
    }

    render() {
        return `
      <div class="container mx-auto px-4 py-8">
        <div id="stm32-flasher-container"></div>
      </div>
    `;
    }

    async show() {
        const content = document.getElementById('page-content');
        if (content) {
            content.innerHTML = this.render();
            this.module.render();
        }
    }

    hide() {
        this.module.hide();
    }
}

window.stm32FlasherPage = new STM32FlasherPage();
