import React, { useState } from 'react';

// Main App component
const App = () => {
  const [glossaries, setGlossaries] = useState([
    { id: 1, name: "Magic Academy's Genius Blinker", text: "A comprehensive glossary for advanced blinking techniques used by students at the Magic Academy, covering spells, incantations, and common errors." },
    { id: 2, name: "Ancient Runes Dictionary", text: "Definitions and pronunciations for various ancient runes, including their magical properties and historical context. Essential for any aspiring runemaster." },
    { id: 3, name: "Potions Ingredients Compendium", text: "A detailed list of rare and common potion ingredients, their effects, and where to source them. Includes warnings for poisonous plants." },
    { id: 4, name: "Short Glossary", text: "Just a short one." },
  ]);
  const [currentGlossaryName, setCurrentGlossaryName] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('***********************************'); // Mock API key

  // Function to simulate loading a glossary
  const handleLoadGlossary = (id) => {
    console.log(`Loading glossary with ID: ${id}`);
    // In a real app, you would fetch and display the glossary text here.
  };

  // Function to simulate deleting a glossary
  const handleDeleteGlossary = (id) => {
    console.log(`Deleting glossary with ID: ${id}`);
    setGlossaries(glossaries.filter(g => g.id !== id));
  };

  // Function to simulate saving the current glossary
  const handleSaveCurrentGlossary = () => {
    if (currentGlossaryName.trim() === '') {
      alert("Please enter a name for the current glossary."); // Using custom modal in real app
      return;
    }
    const newId = Math.max(...glossaries.map(g => g.id), 0) + 1;
    const newGlossary = {
      id: newId,
      name: currentGlossaryName,
      text: "This is a placeholder for the saved glossary content." // Actual content would come from an editor
    };
    setGlossaries([...glossaries, newGlossary]);
    setCurrentGlossaryName('');
    console.log('Current glossary saved:', newGlossary);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans antialiased text-gray-800">
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg p-6 space-y-6">

        {/* Header Section */}
        <h1 className="text-2xl font-bold text-indigo-700 mb-4">Glossary Management</h1>

        {/* Glossary Input Area */}
        <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
          <label htmlFor="glossary-input" className="block text-sm font-medium text-gray-700 mb-2">
            Paste your glossary here.
          </label>
          <textarea
            id="glossary-input"
            rows="6"
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base"
            placeholder="Enter your glossary. The translator will refer to this text to ensure specific words, names, or phrases are handled accurately."
          ></textarea>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75">
              Paste Glossary
            </button>
            <button className="w-full bg-gray-700 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-opacity-75">
              Copy Glossary
            </button>
            <button className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75">
              Clear Glossary
            </button>
          </div>
        </div>

        {/* Manage Saved Glossaries Section */}
        <div className="bg-white p-6 rounded-lg shadow-inner border border-indigo-200">
          <h2 className="text-xl font-semibold text-indigo-700 mb-4">Manage Saved Glossaries</h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              className="flex-grow p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base"
              placeholder="Name for current glossary..."
              value={currentGlossaryName}
              onChange={(e) => setCurrentGlossaryName(e.target.value)}
            />
            <button
              onClick={handleSaveCurrentGlossary}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
            >
              Save Current Glossary
            </button>
          </div>

          <h3 className="text-lg font-medium text-indigo-600 mb-3">Your Saved Glossaries:</h3>
          <div className="space-y-4">
            {glossaries.length === 0 ? (
              <p className="text-gray-500 italic">No glossaries saved yet.</p>
            ) : (
              glossaries.map((glossary) => (
                <div key={glossary.id} className="border border-gray-200 rounded-md p-4 bg-white shadow-sm">
                  <p className="font-semibold text-gray-900 mb-2 break-words">{glossary.name}</p>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">{glossary.text}</p>{/* Added line-clamp for potential long text */}
                  <div className="flex justify-between items-center space-x-2"> {/* Key styling for button spreading */}
                    <button
                      onClick={() => handleLoadGlossary(glossary.id)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-md shadow-sm transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDeleteGlossary(glossary.id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-md shadow-sm transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* API Key Section */}
        <div className="bg-white p-6 rounded-lg shadow-inner border border-gray-200">
          <label htmlFor="api-key" className="block text-xl font-semibold text-gray-700 mb-3">
            Your Gemini API Key (Required):
          </label>
          <div className="relative">
            <input
              id="api-key"
              type="password"
              className="w-full p-3 border border-gray-300 rounded-md pr-10 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base"
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
              readOnly // Make it read-only for demonstration
            />
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 cursor-pointer">
              {/* Eye icon for showing/hiding password - for demonstration */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500 mt-6">
          exzyo.github.io
        </div>

      </div>
    </div>
  );
};

export default App;