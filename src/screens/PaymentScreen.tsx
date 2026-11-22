import React, { useState } from 'react';
import {
  ArrowLeft,
  CreditCard,
  Plus,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  Trash2,
  Lock,
} from 'lucide-react';
import { PaymentMethodItem } from '../types';

interface PaymentScreenProps {
  paymentMethods: PaymentMethodItem[];
  onAddPaymentMethod: (method: PaymentMethodItem) => void;
  onDeletePaymentMethod: (id: string) => void;
  onSetDefaultPaymentMethod: (id: string) => void;
  onBack: () => void;
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  paymentMethods,
  onAddPaymentMethod,
  onDeletePaymentMethod,
  onSetDefaultPaymentMethod,
  onBack,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [methodType, setMethodType] = useState<'card' | 'mobile_money' | 'paypal'>('card');
  const [name, setName] = useState('');
  const [detailInput, setDetailInput] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailInput.trim()) return;

    let brand = 'Card';
    if (methodType === 'mobile_money') brand = 'MTN Mobile Money';
    if (methodType === 'paypal') brand = 'PayPal';
    if (methodType === 'card') brand = 'Visa';

    const newMethod: PaymentMethodItem = {
      id: `pay-${Date.now()}`,
      type: methodType,
      name: methodType === 'card' ? 'Credit or Debit Card' : methodType === 'paypal' ? 'PayPal' : 'Mobile Money',
      details: detailInput.trim(),
      isDefault: false,
      brand,
    };

    onAddPaymentMethod(newMethod);
    setShowAddModal(false);
    setDetailInput('');
    setSuccessMsg('Payment method added successfully.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  return (
    <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col justify-between overflow-y-auto no-scrollbar select-none pb-24">
      <div className="w-full max-w-4xl mx-auto">
        {/* Top Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Payment Method</h1>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-200">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {paymentMethods.map((m) => (
            <div
              key={m.id}
              className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                m.isDefault
                  ? 'border-neutral-600 bg-neutral-900 shadow-md'
                  : 'border-white/5 bg-neutral-950 hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Brand / Type Icon */}
                <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                  {m.type === 'card' && <CreditCard size={20} className="text-neutral-200" />}
                  {m.type === 'paypal' && (
                    <span className="font-bold text-xs text-blue-400 font-mono">PP</span>
                  )}
                  {m.type === 'mobile_money' && (
                    <span className="font-bold text-xs text-yellow-400 font-mono">MoMo</span>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-white">{m.name}</span>
                    {m.isDefault && (
                      <span className="text-[10px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">{m.details}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!m.isDefault && (
                  <button
                    onClick={() => onSetDefaultPaymentMethod(m.id)}
                    className="text-[11px] text-[#E50914] hover:underline px-2 py-1"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => onDeletePaymentMethod(m.id)}
                  className="p-1.5 text-neutral-500 hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 size={15} />
                </button>
                <ChevronRight size={16} className="text-neutral-500" />
              </div>
            </div>
          ))}

          {/* Add Payment Method Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full p-3.5 rounded-xl border border-dashed border-neutral-700 hover:border-neutral-400 bg-neutral-900/40 text-xs font-semibold text-neutral-200 hover:text-white flex items-center justify-between transition-colors mt-2"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-800/80 flex items-center justify-center text-white">
                <Plus size={18} />
              </div>
              <span>Add Payment Method</span>
            </div>
            <ChevronRight size={16} className="text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Security Note at Bottom */}
      <div className="pt-6 flex items-center justify-center gap-1.5 text-xs text-neutral-400 select-none">
        <Lock size={14} className="text-[#46d369]" />
        <span>Secure and encrypted (simulated demonstration)</span>
      </div>

      {/* Add Payment Method Form Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full sm:max-w-md bg-neutral-900 border border-neutral-700 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">Add Payment Method</h3>
              <button onClick={() => setShowAddModal(false)} className="text-xs text-neutral-400 hover:text-white">
                Cancel
              </button>
            </div>

            {/* Type selector tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMethodType('card')}
                className={`py-2 rounded-lg text-xs font-semibold border ${
                  methodType === 'card'
                    ? 'border-[#E50914] bg-[#E50914]/15 text-white'
                    : 'border-neutral-700 text-neutral-400'
                }`}
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setMethodType('mobile_money')}
                className={`py-2 rounded-lg text-xs font-semibold border ${
                  methodType === 'mobile_money'
                    ? 'border-[#E50914] bg-[#E50914]/15 text-white'
                    : 'border-neutral-700 text-neutral-400'
                }`}
              >
                Mobile Money
              </button>
              <button
                type="button"
                onClick={() => setMethodType('paypal')}
                className={`py-2 rounded-lg text-xs font-semibold border ${
                  methodType === 'paypal'
                    ? 'border-[#E50914] bg-[#E50914]/15 text-white'
                    : 'border-neutral-700 text-neutral-400'
                }`}
              >
                PayPal
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  {methodType === 'card'
                    ? 'Card Number (Simulated)'
                    : methodType === 'mobile_money'
                    ? 'Mobile Money Number (e.g. +256 77...)'
                    : 'PayPal Email'}
                </label>
                <input
                  type="text"
                  value={detailInput}
                  onChange={(e) => setDetailInput(e.target.value)}
                  placeholder={
                    methodType === 'card'
                      ? '•••• •••• •••• 4242'
                      : methodType === 'mobile_money'
                      ? '+256 772 987654'
                      : 'ashraf@example.com'
                  }
                  className="w-full h-11 px-3 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-[#E50914] hover:bg-[#f40612] text-white font-bold text-xs rounded-lg transition-colors mt-2"
              >
                Save Payment Method
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
