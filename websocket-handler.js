class WebSocketHandler {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.roomId = this.extractRoomId();
    }

    extractRoomId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('room') || window.location.pathname.split('/').pop();
    }

    async validateRoom() {
        try {
            const response = await fetch(`/api/rooms/${this.roomId}/validate`);
            if (!response.ok) {
                if (response.status === 404) {
                    this.handleRoomNotFound();
                    return false;
                }
                throw new Error(`Room validation failed: ${response.status}`);
            }
            return true;
        } catch (error) {
            console.error('Room validation error:', error);
            this.handleRoomValidationError();
            return false;
        }
    }

    async connect() {
        // Validate room before attempting WebSocket connection
        const isValidRoom = await this.validateRoom();
        if (!isValidRoom) {
            return;
        }

        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected successfully');
                this.reconnectAttempts = 0;
                this.showUserMessage('Connected to video call service', 'success');
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.handleConnectionError();
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                this.handleConnectionClose(event);
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.handleConnectionError();
        }
    }

    handleRoomNotFound() {
        this.showUserMessage('This video call link is invalid or has expired.', 'error');
        this.showRoomNotFoundActions();
    }

    handleRoomValidationError() {
        this.showUserMessage('Unable to verify the video call room. Please try again.', 'error');
    }

    showRoomNotFoundActions() {
        const actionsHtml = `
            <div class="error-actions">
                <p>The video call you're trying to join doesn't exist or has ended.</p>
                <div class="action-buttons">
                    <button onclick="window.location.href='/'" class="btn btn-primary">
                        Start New Call
                    </button>
                    <button onclick="this.requestNewLink()" class="btn btn-secondary">
                        Request New Link
                    </button>
                </div>
            </div>
        `;
        
        const container = document.getElementById('video-container');
        if (container) {
            container.innerHTML = actionsHtml;
        }
    }

    requestNewLink() {
        const email = prompt('Enter your email to request a new video call link:');
        if (email) {
            this.showUserMessage('New link request sent. Please check your email.', 'info');
            // Send request to backend
            fetch('/api/request-new-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, originalRoom: this.roomId })
            });
        }
    }

    handleConnectionError() {
        this.showUserMessage('Unable to connect to video call service. Please check your internet connection and try again.', 'error');
        this.attemptReconnect();
    }

    handleConnectionClose(event) {
        if (event.code === 1000) {
            // Normal closure
            this.showUserMessage('Connection closed', 'info');
        } else {
            // Abnormal closure
            this.showUserMessage('Connection lost. Attempting to reconnect...', 'warning');
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
            
            setTimeout(() => {
                this.showUserMessage(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info');
                this.connect();
            }, delay);
        } else {
            this.showUserMessage('Unable to establish connection. Please refresh the page and try again.', 'error');
        }
    }

    showUserMessage(message, type) {
        const messageElement = document.getElementById('connection