class ChatInterface {
    constructor() {
        // Vul hier je API credentials in
        this.apiKey = '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';
        this.assistantId = 'asst_1vkOOlMmfySQz9lMckgn2te1';
        
        this.initializeElements();
        this.addEventListeners();
    }

    initializeElements() {
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-button');

        // Voeg welkomstbericht toe
        this.addMessage("👋 Hoe kan ik u assisteren vandaag?", false);
    }

    addEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    addMessage(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        messageDiv.textContent = content;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async sendMessage() {
        if (!this.apiKey || !this.assistantId) {
            alert('Please set your API Key and Assistant ID in the code!');
            return;
        }

        const userMessage = this.userInput.value.trim();
        if (!userMessage) return;

        this.addMessage(userMessage, true);
        this.userInput.value = '';
        
        try {
            // Create a thread
            console.log('Creating thread...');
            const threadResponse = await fetch('https://api.openai.com/v1/threads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            if (!threadResponse.ok) {
                const error = await threadResponse.json();
                throw new Error(`Failed to create thread: ${error.error?.message || 'Unknown error'}`);
            }

            const thread = await threadResponse.json();

            // Add message to thread
            const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'assistants=v2'
                },
                body: JSON.stringify({
                    role: 'user',
                    content: userMessage
                })
            });

            if (!messageResponse.ok) {
                const error = await messageResponse.json();
                throw new Error(`Failed to add message: ${error.error?.message || 'Unknown error'}`);
            }

            // Run the assistant
            const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'assistants=v2'
                },
                body: JSON.stringify({
                    assistant_id: this.assistantId
                })
            });

            if (!runResponse.ok) {
                const error = await runResponse.json();
                throw new Error(`Failed to run assistant: ${error.error?.message || 'Unknown error'}`);
            }

            const run = await runResponse.json();

            // Poll for completion
            let runStatus = await this.pollRunStatus(thread.id, run.id);

            if (runStatus === 'completed') {
                const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'OpenAI-Beta': 'assistants=v2'
                    }
                });

                if (!messagesResponse.ok) {
                    const error = await messagesResponse.json();
                    throw new Error(`Failed to get messages: ${error.error?.message || 'Unknown error'}`);
                }

                const messages = await messagesResponse.json();
                
                if (messages.data && messages.data[0]) {
                    this.addMessage(messages.data[0].content[0].text.value);
                } else {
                    throw new Error('No message content received from assistant');
                }
            } else {
                throw new Error(`Run failed with status: ${runStatus}`);
            }
        } catch (error) {
            console.error('Error:', error);
            this.addMessage(`Error: ${error.message}`);
        }
    }

    async pollRunStatus(threadId, runId) {
        let status = 'in_progress';
        
        while (status === 'in_progress' || status === 'queued') {
            const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'assistants=v2'
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Failed to check run status: ${error.error?.message || 'Unknown error'}`);
            }

            const runStatus = await response.json();
            status = runStatus.status;

            if (status === 'in_progress' || status === 'queued') {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return status;
    }
}

// Initialize the chat interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatInterface();
});
