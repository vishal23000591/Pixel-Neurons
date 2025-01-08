import { streamGemini } from './bot.js';

// DOM elements
let form = document.querySelector('form');
let promptInput = document.querySelector('input[name="prompt"]');
let output = document.querySelector('.conversation'); // Chat window where messages will appear
let sendButton = document.getElementById('send-button');
let userInput = document.getElementById('user-input');
let micButton = document.getElementById('mic-button'); // Button for voice input

// Update conversation with a new message
function addMessage(text, role) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  messageDiv.classList.add(role === 'user' ? 'user-message' : 'bot-message');
  messageDiv.innerHTML = text; // Use innerHTML to render HTML/markdown content
  output.appendChild(messageDiv);
  output.scrollTop = output.scrollHeight; // Scroll to the bottom
}

// Handle form submission (user sending input)
sendButton.onclick = async (ev) => {
  ev.preventDefault();

  const inputText = userInput.value.trim();
  if (!inputText) return; // Don't send empty input

  addMessage(inputText, 'user'); // Add user message to the conversation
  userInput.value = ''; // Clear the input field
  sendButton.disabled = true; // Disable the send button during processing
  addMessage('Generating...', 'bot'); // Placeholder message while waiting for bot's response

  try {
    // Prepare the input content for the Gemini model
    let contents = [{ type: "text", text: inputText }];

    // Call the Gemini model to get a stream of responses
    let stream = streamGemini({ model: 'gemini-pro', contents });

    // Handle and display each chunk of response
    let buffer = [];
    let md = new markdownit(); // Initialize markdown renderer
    for await (let chunk of stream) {
      if (chunk && chunk.trim()) {
        buffer.push(chunk);
        const renderedText = md.render(buffer.join('')); // Render markdown as HTML
        // Update the last bot message with the new chunk, rendering as HTML
        output.lastElementChild.innerHTML = renderedText;
      }
    }

    if (buffer.length === 0) {
      output.lastElementChild.textContent = 'I’m sorry, I couldn’t generate a response. Please try again.';
    }

    sendButton.disabled = false; // Enable the send button after processing
  } catch (e) {
    // Handle errors (e.g., API call failure)
    output.lastElementChild.textContent = `Error: ${e.message || e}`;
    console.error('Error generating response:', e);
    sendButton.disabled = false;
  }
};

// Handle pressing "Enter" key to send message
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendButton.click();
  }
});

// Initialize conversation with a welcome message
window.onload = () => {
  addMessage('Hello! How can I assist you today?', 'bot');
};

// Handle voice input using Speech Recognition
let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';

recognition.onstart = function () {
  console.log('Voice recognition started');
};

recognition.onresult = function (event) {
  const transcript = event.results[0][0].transcript;
  console.log('User said: ', transcript);
  // Send this transcript to your chatbot
  userInput.value = transcript;
  sendButton.click(); // Automatically send the voice input as text
};

recognition.onerror = function(event) {
  console.error('Speech recognition error', event.error);
};

// Start voice recognition when the mic button is clicked
micButton.onclick = () => {
  recognition.start();
};
