import React, { useState } from 'react';
import { Cast, Tv, Laptop, Check, X } from 'lucide-react';

interface CastModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedDevice?: string | null;
  onConnect: (deviceName: string | null) => void;
}

export const CastModal: React.FC<CastModalProps> = ({
  isOpen,
  onClose,
  connectedDevice,
  onConnect,
}) => {
  const [connectingId, setConnectingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const devices = [
    { id: 'living-room', name: 'Living Room TV', type: 'tv', desc: 'Samsung 65" 4K UHD' },
    { id: 'bedroom', name: 'Bedroom Chromecast', type: 'tv', desc: 'Google TV 4K' },
    { id: 'apple-tv', name: "Ashraf's Apple TV", type: 'tv', desc: 'Apple TV 4K (2nd Gen)' },
    { id: 'macbook', name: 'MacBook Pro AirPlay', type: 'laptop', desc: 'Ready to cast' },
  ];

  const handleSelect = (deviceName: string) => {
    if (connectedDevice === deviceName) {
      onConnect(null);
      return;
    }
    setConnectingId(deviceName);
    setTimeout(() => {
      setConnectingId(null);
      onConnect(deviceName);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-sm bg-neutral-900 border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Cast size={20} className="text-[#E50914]" />
            <h3 className="font-bold text-white text-base">Cast to Device</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/80 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-neutral-400">
          Select a screen on your Wi-Fi network to stream Netflux content directly.
        </p>

        <div className="flex flex-col gap-2">
          {devices.map((dev) => {
            const isConnected = connectedDevice === dev.name;
            const isConnecting = connectingId === dev.name;

            return (
              <button
                key={dev.id}
                onClick={() => handleSelect(dev.name)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  isConnected
                    ? 'border-[#E50914] bg-[#E50914]/15 text-white'
                    : 'border-white/5 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isConnected ? 'bg-[#E50914] text-white' : 'bg-white/10 text-neutral-300'
                    }`}
                  >
                    {dev.type === 'laptop' ? <Laptop size={18} /> : <Tv size={18} />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{dev.name}</div>
                    <div className="text-[11px] text-neutral-400">{dev.desc}</div>
                  </div>
                </div>

                {isConnecting ? (
                  <span className="text-[11px] text-[#E50914] animate-pulse">Connecting...</span>
                ) : isConnected ? (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#E50914]">
                    <Check size={14} />
                    Connected
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {connectedDevice && (
          <button
            onClick={() => onConnect(null)}
            className="w-full py-2.5 rounded-xl border border-white/20 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Disconnect from {connectedDevice}
          </button>
        )}
      </div>
    </div>
  );
};
