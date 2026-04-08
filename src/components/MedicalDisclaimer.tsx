import { AlertCircle } from 'lucide-react';

export function MedicalDisclaimer() {
  return (
    <div className="bg-dragon-warm/50 border border-dragon-gold/20 rounded-2xl p-6 mt-12 mb-8">
      <div className="flex items-start gap-4">
        <div className="bg-dragon-gold/10 p-2 rounded-full mt-1">
          <AlertCircle className="w-5 h-5 text-dragon-gold" />
        </div>
        <div className="flex-1">
          <h4 className="serif text-lg font-bold text-dragon-ink mb-2">Medical Disclaimer</h4>
          <p className="text-sm text-dragon-muted leading-relaxed">
            This app concept is for habit-tracking and wellness purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Users should always follow their healthcare provider's instructions regarding their health and wellness routines.
          </p>
        </div>
      </div>
    </div>
  );
}
