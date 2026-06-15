import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex justify-between items-center px-8 py-5 z-10">
        <div className="text-xl font-bold tracking-tight">
          <span style={{color: '#7C5CFC'}}>Eclatale</span>
        </div>
        <button className="text-sm px-5 py-2 rounded-full border border-white/20 hover:border-purple-500 transition-all">
          Get Early Access
        </button>
      </nav>

      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-block text-xs px-4 py-1.5 rounded-full mb-8 border"
          style={{background: '#7C5CFC20', borderColor: '#7C5CFC50', color: '#A78BFA'}}>
          AI Personal Brand Growth OS
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Burst onto your
          <span style={{color: '#7C5CFC'}}> industry.</span>
        </h1>
        
        <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto">
          Eclatale learns your authentic voice, generates content in your style, 
          and tracks real career outcomes. Not a LinkedIn optimizer — a growth engine.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-8 py-4 rounded-full font-semibold text-white transition-all"
            style={{background: '#7C5CFC'}}>
            Start Growing Free
          </button>
          <button className="px-8 py-4 rounded-full font-semibold border border-white/20 hover:border-white/40 transition-all">
            See How It Works
          </button>
        </div>

        {/* Social proof */}
        <p className="mt-10 text-sm text-gray-500">
          Join 500+ founders and executives building their personal brand
        </p>
      </div>

    </div>
  );
}

export default App;