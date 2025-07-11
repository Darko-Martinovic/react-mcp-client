import React, { useState, FormEvent, ChangeEvent } from 'react';

interface Message {
  sender: 'user' | 'system';
  text: string;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages([...messages, { sender: 'user', text: input }]);
    setInput('');
    // Placeholder: Add system response logic here in future steps
  };

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto', border: '1px solid #ccc', borderRadius: 8, padding: 16 }}>
      <div style={{ minHeight: 200, marginBottom: 16 }}>
        {messages.length === 0 && <div style={{ color: '#888' }}>No messages yet.</div>}
        {messages.map((msg, idx) => (
          <div key={idx} style={{ textAlign: msg.sender === 'user' ? 'right' : 'left', margin: '8px 0' }}>
            <span style={{ background: msg.sender === 'user' ? '#e0f7fa' : '#f1f8e9', padding: '6px 12px', borderRadius: 16, display: 'inline-block' }}>
              {msg.text}
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1976d2', color: '#fff' }}>
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat; 