// Device dimensions
const DEVICE_WIDTH = 320;
const DEVICE_HEIGHT = 720;

// Initial state setup
window.state = {
    currentFrame: null
};

// Setup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    const simulator = document.getElementById('simulator');
    const selectionBox = document.getElementById('selectionBox');

    // Set up video sharing
    setupVideoSharing();
});

// Video sharing setup
async function setupVideoSharing() {
    const videoElement = document.getElementById('bgVideo');
    const shareButton = document.getElementById('setVideoSource');

    shareButton.addEventListener('click', async () => {
        try {
            const displayMediaOptions = {
                video: {
                    cursor: "always"
                },
                audio: false
            };
            videoElement.srcObject = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            videoElement.play();
        } catch (err) {
            console.error("Error sharing screen: ", err);
        }
    });
}

// Export necessary functions
window.setupVideoSharing = setupVideoSharing;