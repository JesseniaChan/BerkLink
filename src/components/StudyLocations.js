import React, { useState } from 'react';
import { saveOnboardingStep } from '../services/onboardingService';
import '../styles/StudyLocations.css';

const LOCATIONS = [
  // Libraries
  { id: 'doe',          name: 'Doe Library',                  category: 'library', emoji: '📚' },
  { id: 'moffitt',      name: 'Moffitt Library',               category: 'library', emoji: '📚' },
  { id: 'bancroft',     name: 'Bancroft Library',              category: 'library', emoji: '📚' },
  { id: 'morrison',     name: 'Morrison Library',              category: 'library', emoji: '📚' },
  { id: 'bioscience',   name: 'Bioscience Library',            category: 'library', emoji: '📚' },
  { id: 'engineering',  name: 'Engineering Library',           category: 'library', emoji: '📚' },
  { id: 'eastasian',    name: 'East Asian Library',            category: 'library', emoji: '📚' },
  { id: 'earthsci',     name: 'Earth Sciences Library',        category: 'library', emoji: '📚' },
  { id: 'chemistry',    name: 'Chemistry Library',             category: 'library', emoji: '📚' },
  { id: 'physics',      name: 'Physics Library',               category: 'library', emoji: '📚' },
  // Campus spots
  { id: 'glade',        name: 'The Glade',                    category: 'campus',  emoji: '🌿' },
  { id: 'standard',     name: 'The Standard',                  category: 'campus',  emoji: '🏢' },
  { id: 'mlk',          name: 'MLK Student Union',             category: 'campus',  emoji: '🏛️' },
  // Cafés
  { id: 'strada',       name: 'Caffe Strada',                  category: 'cafe',    emoji: '☕' },
  { id: 'waywest',      name: 'Waywest Coffee',                category: 'cafe',    emoji: '☕' },
  { id: 'yalis_mlk',   name: "Yali's Café (MLK)",             category: 'cafe',    emoji: '☕' },
  { id: 'yalis_sd',    name: "Yali's Café (Sutardja Dai)",    category: 'cafe',    emoji: '☕' },
  { id: 'fsm',          name: 'Free Speech Movement Café',     category: 'cafe',    emoji: '☕' },
  { id: 'nefeli',       name: 'Nefeli Caffe',                  category: 'cafe',    emoji: '☕' },
  { id: 'brewed',       name: 'Brewed Awakening',              category: 'cafe',    emoji: '☕' },
  { id: 'bluebottle',   name: 'Blue Bottle Coffee',            category: 'cafe',    emoji: '☕' },
  { id: 'sufficient',   name: 'Sufficient Grounds',            category: 'cafe',    emoji: '☕' },
];

const TIERS = [
  { id: 'S', description: 'My absolute favourites' },
  { id: 'A', description: 'Great spots' },
  { id: 'B', description: 'Pretty good' },
  { id: 'C', description: 'It\'s fine' },
  { id: 'D', description: 'Not really my thing' },
  { id: 'F', description: 'Never again' },
];

const LOC_BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));

export default function StudyLocations({ userId, onNext, onSkip }) {
  const [tiers, setTiers] = useState({ S: [], A: [], B: [], C: [], D: [], F: [] });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rankedIds = new Set(Object.values(tiers).flat());
  const unranked = LOCATIONS.filter((loc) => !rankedIds.has(loc.id));

  const assignToTier = (tierId) => {
    if (!selected) return;
    setTiers((prev) => ({ ...prev, [tierId]: [...prev[tierId], selected] }));
    setSelected(null);
  };

  const removeFromTier = (tierId, locId) => {
    setTiers((prev) => ({ ...prev, [tierId]: prev[tierId].filter((id) => id !== locId) }));
  };

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await saveOnboardingStep(userId, { study_location_tiers: tiers });
    } catch (err) {
      console.warn('Could not save location tiers (column may not exist yet):', err.message);
    } finally {
      setLoading(false);
      if (onNext) onNext({ study_location_tiers: tiers });
    }
  };

  const selectedLoc = selected ? LOC_BY_ID[selected] : null;
  const hasAnyRanked = rankedIds.size > 0;

  return (
    <div className="locations-container">
      <div className="locations-card">
        <h2 className="locations-heading">Where Do You Like to Study?</h2>
        <p className="locations-subtitle">
          Rank Berkeley's libraries, campus spots, and nearby cafés. Click a location, then click a tier to place it. You can put as many as you want in each tier.
        </p>

        {error && <div className="loc-error-msg">{error}</div>}

        <form onSubmit={handleNext}>

          {/* ── TIER LIST ── */}
          <div className="tier-list">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`tier-row tier-${tier.id}${selected ? ' droppable' : ''}`}
                onClick={() => selected && assignToTier(tier.id)}
                title={selected ? `Place in ${tier.id} tier` : tier.description}
              >
                <div className="tier-label-col">
                  <span className="tier-letter">{tier.id}</span>
                </div>
                <div className="tier-chips-col">
                  {tiers[tier.id].map((locId) => {
                    const loc = LOC_BY_ID[locId];
                    return (
                      <div
                        key={locId}
                        className="tier-chip"
                        onClick={(e) => { e.stopPropagation(); removeFromTier(tier.id, locId); }}
                        title="Click to remove"
                      >
                        {loc.emoji} {loc.name}
                        <span className="chip-x">×</span>
                      </div>
                    );
                  })}
                  {selected && (
                    <span className="tier-drop-hint">
                      Drop "{selectedLoc?.name}" here
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── UNRANKED POOL ── */}
          <div className="unranked-section">
            <div className="unranked-header">
              {selectedLoc ? (
                <span className="unranked-instruction">
                  <strong>{selectedLoc.emoji} {selectedLoc.name}</strong> selected — click a tier above to place it, or click it again to deselect
                </span>
              ) : (
                <span className="unranked-instruction">
                  Unranked locations ({unranked.length}) — click one to select it, then click a tier row above
                </span>
              )}
            </div>

            <div className="unranked-pool">
              {unranked.length === 0 ? (
                <span className="all-ranked-msg">🎉 All locations ranked!</span>
              ) : (
                unranked.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    className={`unranked-chip cat-${loc.category}${selected === loc.id ? ' selected' : ''}`}
                    onClick={() => setSelected((prev) => (prev === loc.id ? null : loc.id))}
                  >
                    {loc.emoji} {loc.name}
                  </button>
                ))
              )}
            </div>

            {/* Category legend */}
            <div className="category-legend">
              <span className="legend-item"><span className="legend-dot cat-library" />Libraries</span>
              <span className="legend-item"><span className="legend-dot cat-campus" />Campus spots</span>
              <span className="legend-item"><span className="legend-dot cat-cafe" />Cafés</span>
            </div>
          </div>

          <div className="loc-button-group">
            <button type="submit" disabled={loading} className="loc-next-btn">
              {loading ? 'Saving...' : 'Next →'}
            </button>
            <button
              type="button"
              onClick={() => onSkip && onSkip()}
              disabled={loading}
              className="loc-skip-btn"
            >
              {hasAnyRanked ? 'Save & Skip Rest' : 'Skip for Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
