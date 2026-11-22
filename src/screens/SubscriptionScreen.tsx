import React, { useState } from 'react';
import { ArrowLeft, Crown, Check, CheckCircle2 } from 'lucide-react';
import { SubscriptionPlan } from '../types';
import { SUBSCRIPTION_PLANS } from '../data/mockData';

interface SubscriptionScreenProps {
  currentPlan: SubscriptionPlan;
  onUpdatePlan: (planId: string) => void;
  onBack: () => void;
}

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({
  currentPlan,
  onUpdatePlan,
  onBack,
}) => {
  const [showTierPicker, setShowTierPicker] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(currentPlan.id);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSavePlan = () => {
    onUpdatePlan(selectedPlanId);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setShowTierPicker(false);
    }, 800);
  };

  return (
    <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      <div className="w-full max-w-5xl mx-auto flex flex-col">
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
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Your Plan</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Active Plan Card */}
          <div className="lg:col-span-7 bg-neutral-900 border border-neutral-700 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">{currentPlan.name}</h2>
                <p className="text-xs text-amber-400 font-semibold">{currentPlan.quality} · {currentPlan.resolution}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Crown size={22} className="stroke-[2]" />
              </div>
            </div>

            <div className="flex flex-col gap-2.5 my-5">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-neutral-200">
                <Check size={16} className="text-[#46d369] shrink-0" />
                <span>Watch on {currentPlan.devices} devices simultaneously</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-neutral-200">
                <Check size={16} className="text-[#46d369] shrink-0" />
                <span>Download on {currentPlan.downloads} devices</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-neutral-200">
                <Check size={16} className="text-[#46d369] shrink-0" />
                <span>Ad-free uninterrupted movies &amp; shows</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-neutral-200">
                <Check size={16} className="text-[#46d369] shrink-0" />
                <span>Spatial Audio with cinematic surround</span>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400 mb-5">
              <span>Current subscription</span>
              <span className="font-bold text-white text-sm">{currentPlan.price}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowTierPicker(true)}
              className="w-full h-11 bg-white hover:bg-neutral-200 active:scale-[0.98] text-black font-bold text-xs sm:text-sm rounded-lg transition-all cursor-pointer"
            >
              Change Plan
            </button>
          </div>

          {/* Membership Details Column */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-5 bg-neutral-950 rounded-2xl border border-white/10 flex flex-col gap-2 text-xs text-neutral-400">
              <span className="font-bold text-neutral-200 text-sm">Billing Information</span>
              <span>Next billing date: December 12, 2026 via MTN Mobile Money</span>
              <span className="text-[11px] text-neutral-500">
                Cancel or switch tiers anytime. Changes take effect next billing period.
              </span>
            </div>

            <div className="p-5 bg-neutral-950 rounded-2xl border border-white/10 flex flex-col gap-2.5">
              <span className="font-bold text-neutral-200 text-sm">Available UGX Plans</span>
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    onUpdatePlan(plan.id);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                    currentPlan.id === plan.id
                      ? 'border-[#E50914] bg-[#E50914]/10'
                      : 'border-white/5 bg-neutral-900/50 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-white">{plan.name}</div>
                    <div className="text-[11px] text-neutral-400">{plan.resolution}</div>
                  </div>
                  <span className="text-xs font-bold text-white">{plan.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tier Switcher Modal / Sheet */}
      {showTierPicker && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full sm:max-w-md bg-neutral-900 border border-neutral-700 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">Select Subscription Plan</h3>
              <button
                onClick={() => setShowTierPicker(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {savedSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center gap-2 text-xs text-emerald-200">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Subscription successfully updated!</span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#E50914] bg-[#E50914]/10 shadow-lg'
                        : 'border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{plan.name}</span>
                        {plan.isPopular && (
                          <span className="text-[10px] bg-red-600/30 text-red-400 px-1.5 py-0.5 rounded font-bold">
                            POPULAR
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-white text-xs">{plan.price}</span>
                    </div>

                    <div className="text-[11px] text-neutral-400 mb-2">
                      {plan.resolution} · {plan.devices} device(s)
                    </div>

                    <div className="flex flex-col gap-1 text-[11px] text-neutral-300">
                      {plan.features.slice(0, 2).map((feat, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <Check size={12} className="text-[#46d369]" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowTierPicker(false)}
                className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                className="flex-1 py-2.5 rounded-lg bg-[#E50914] hover:bg-[#f40612] text-white text-xs font-bold transition-colors"
              >
                Confirm Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
