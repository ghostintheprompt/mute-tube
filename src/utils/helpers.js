export function isAdElement(element) {
    return element && element.classList && element.classList.contains('ad-container');
}

export function muteVideo(videoElement) {
    if (videoElement) {
        videoElement.muted = true;
    }
}

export function resumePlayback(videoElement) {
    if (videoElement && videoElement.paused) {
        videoElement.play();
    }
}

export function isVideoPlaying(videoElement) {
    return videoElement && !videoElement.paused;
}