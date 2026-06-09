/* ======================================================
   MotorGuage — Application Logic
   ====================================================== */

// ---- DOM Elements ----
const form = document.getElementById('estimatorForm');
const makeSelect = document.getElementById('carMake');
const modelSelect = document.getElementById('carModel');
const variantSelect = document.getElementById('carVariant');
const yearSelect = document.getElementById('carYear');
const fuelSelect = document.getElementById('fuelType');
const transmissionSelect = document.getElementById('transmissionType');
const engineInput = document.getElementById('engineCapacity');
const mileageInput = document.getElementById('mileage');
const citySelect = document.getElementById('regCity');
const colorInput = document.getElementById('carColor');
const colorOptions = document.getElementById('colorOptions');
const colorLabel = document.getElementById('colorLabel');
const progressBar = document.getElementById('progressBar');
const submitBtn = document.getElementById('submitBtn');
const resultPanel = document.getElementById('resultPanel');
const resetBtn = document.getElementById('resetBtn');

const modelApi = window.MotorGuageModel;
const metadata = modelApi.metadata;

const cityToRegion = {
    karachi: 'Sindh',
    hyderabad: 'Sindh',
    sukkur: 'Sindh',
    larkana: 'Sindh',
    islamabad: 'Islamabad',
    lahore: 'Punjab',
    rawalpindi: 'Punjab',
    faisalabad: 'Punjab',
    multan: 'Punjab',
    sialkot: 'Punjab',
    gujranwala: 'Punjab',
    bahawalpur: 'Punjab',
    sargodha: 'Punjab',
    sahiwal: 'Punjab',
    jhang: 'Punjab',
};

// ---- Helpers ----
function key(...parts) {
    return modelApi.key(parts);
}

function createOption(value, label = value) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    return opt;
}

function resetSelect(select, placeholder, disabled = true) {
    select.innerHTML = '';
    select.appendChild(createOption('', placeholder));
    select.value = '';
    select.disabled = disabled;
}

function fillSelect(select, values, placeholder) {
    resetSelect(select, placeholder, false);
    values.forEach(item => {
        if (typeof item === 'object') {
            select.appendChild(createOption(item.value, item.label));
        } else {
            select.appendChild(createOption(item));
        }
    });
}

function selectedOptionText(select) {
    return select.options[select.selectedIndex]?.textContent || '';
}

function registrationRegion() {
    return cityToRegion[citySelect.value] || selectedOptionText(citySelect) || 'Punjab';
}

function formatLakh(value) {
    if (value >= 10000000) {
        return (value / 10000000).toFixed(2) + ' Crore';
    }
    return (value / 100000).toFixed(1) + ' Lakh';
}

function impactLabel(value) {
    if (value >= 80) return 'Very High';
    if (value >= 60) return 'High Impact';
    if (value >= 40) return 'Medium Impact';
    return 'Low Impact';
}

function trackEvent(name, params = {}) {
    window.MotorGuageAnalytics?.event(name, params);
}

function trackFieldChanged(fieldName, fieldValue, extra = {}) {
    trackEvent('estimator_field_changed', {
        field_name: fieldName,
        field_value: fieldValue,
        ...extra,
    });
}

// ---- Populate Static Selects From Model Metadata ----
function populateMakes() {
    resetSelect(makeSelect, 'Select make', false);
    metadata.makes.forEach(make => {
        makeSelect.appendChild(createOption(make));
    });
}

function populateYears() {
    const currentYear = Math.max(new Date().getFullYear(), metadata.yearMax);
    resetSelect(yearSelect, 'Select year', false);
    for (let year = currentYear; year >= metadata.yearMin; year--) {
        yearSelect.appendChild(createOption(year));
    }
}

// ---- Cascading Dropdowns ----
makeSelect.addEventListener('change', () => {
    const make = makeSelect.value;
    const models = metadata.modelsByMake[make] || [];

    fillSelect(modelSelect, models, 'Select model');
    resetSelect(variantSelect, 'Select model first');
    resetSelect(fuelSelect, 'Select variant first');
    resetSelect(transmissionSelect, 'Select variant first');
    engineInput.value = '';
    updateProgress();
    trackFieldChanged('make', make, {
        available_models: models.length,
    });
});

modelSelect.addEventListener('change', () => {
    const make = makeSelect.value;
    const model = modelSelect.value;
    const variants = metadata.variantsByMakeModel[key(make, model)] || [];

    fillSelect(variantSelect, variants, 'Select variant');
    resetSelect(fuelSelect, 'Select variant first');
    resetSelect(transmissionSelect, 'Select variant first');
    engineInput.value = '';
    updateProgress();
    trackFieldChanged('model', model, {
        make,
        available_variants: variants.length,
    });
});

variantSelect.addEventListener('change', () => {
    const make = makeSelect.value;
    const model = modelSelect.value;
    const variant = variantSelect.value;
    const groupKey = key(make, model, variant);
    const fuels = metadata.fuelByMakeModelVariant[groupKey] || ['Petrol'];
    const transmissions = metadata.transmissionByMakeModelVariant[groupKey] || ['Automatic', 'Manual'];

    fillSelect(fuelSelect, fuels, 'Select fuel type');
    fillSelect(transmissionSelect, transmissions, 'Select transmission');
    if (fuels.length === 1) fuelSelect.value = fuels[0];
    if (transmissions.length === 1) transmissionSelect.value = transmissions[0];
    updateEngineFromSelection();
    updateProgress();
    trackFieldChanged('variant', variant, {
        make,
        model,
        available_fuel_types: fuels.length,
        available_transmissions: transmissions.length,
    });
});

fuelSelect.addEventListener('change', () => {
    updateEngineFromSelection();
    updateProgress();
    trackFieldChanged('fuel_type', fuelSelect.value, {
        make: makeSelect.value,
        model: modelSelect.value,
        variant: variantSelect.value,
    });
});

function updateEngineFromSelection() {
    const engineKey = key(makeSelect.value, modelSelect.value, variantSelect.value, fuelSelect.value);
    const engines = metadata.engineByMakeModelVariantFuel[engineKey] || [];
    if (engines.length) {
        engineInput.value = engines[0];
    }
}

// ---- Color Selector ----
colorOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.color-option');
    if (!btn) return;

    colorOptions.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    colorInput.value = btn.dataset.label;
    colorLabel.textContent = btn.dataset.label;
    colorLabel.style.color = 'var(--text-secondary)';
    updateProgress();
    trackEvent('estimator_color_selected', {
        color: btn.dataset.label,
    });
});

// ---- Progress Bar ----
const formFields = [
    makeSelect,
    modelSelect,
    variantSelect,
    yearSelect,
    fuelSelect,
    transmissionSelect,
    engineInput,
    mileageInput,
    citySelect,
    colorInput,
];

function updateProgress() {
    const filled = formFields.filter(field => field.value && field.value !== '').length;
    const percent = (filled / formFields.length) * 100;
    progressBar.style.width = `${percent}%`;
}

[makeSelect, modelSelect, variantSelect, yearSelect, fuelSelect, transmissionSelect, citySelect].forEach(el => {
    el.addEventListener('change', updateProgress);
});

[engineInput, mileageInput].forEach(el => {
    el.addEventListener('input', updateProgress);
});

yearSelect.addEventListener('change', () => {
    trackFieldChanged('year', yearSelect.value);
});

transmissionSelect.addEventListener('change', () => {
    trackFieldChanged('transmission', transmissionSelect.value, {
        make: makeSelect.value,
        model: modelSelect.value,
        variant: variantSelect.value,
    });
});

citySelect.addEventListener('change', () => {
    trackFieldChanged('registration_city', selectedOptionText(citySelect), {
        registration_region: registrationRegion(),
    });
});

engineInput.addEventListener('change', () => {
    trackFieldChanged('engine_cc', Number(engineInput.value));
});

mileageInput.addEventListener('change', () => {
    const mileageBucket = window.MotorGuageAnalytics?.mileageBucket(mileageInput.value);
    trackFieldChanged('mileage', mileageBucket, {
        mileage_bucket: mileageBucket,
    });
});

// ---- Form Submission ----
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!colorInput.value) {
        colorLabel.textContent = 'Please select a color';
        colorLabel.style.color = '#ef4444';
        trackEvent('estimator_validation_error', {
            missing_field: 'color',
        });
        return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    trackEvent('price_estimate_started', {
        make: makeSelect.value,
        model: modelSelect.value,
        variant: variantSelect.value,
        year: Number(yearSelect.value),
        fuel_type: fuelSelect.value,
        transmission: transmissionSelect.value,
        color: colorInput.value,
        registration_region: registrationRegion(),
        mileage_bucket: window.MotorGuageAnalytics?.mileageBucket(mileageInput.value),
        engine_cc: Number(engineInput.value),
    });

    try {
        await runEstimate();
    } catch (error) {
        trackEvent('price_estimate_failed', {
            error_message: error.message || 'unknown_error',
        });
        alert(error.message || 'Could not calculate estimate. Please check your inputs.');
    }

    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
});

// ---- Model Estimate ----
async function runEstimate() {
    await new Promise(resolve => setTimeout(resolve, 450));

    const payload = {
        make: makeSelect.value,
        model: modelSelect.value,
        variant: variantSelect.value,
        fuel_type: fuelSelect.value,
        year: Number(yearSelect.value),
        mileage_km: Number(mileageInput.value),
        engine_cc: Number(engineInput.value),
        transmission: transmissionSelect.value,
        color: colorInput.value,
        registered_in: registrationRegion(),
    };

    const result = modelApi.predict(payload);
    const makeName = makeSelect.value;
    const modelName = modelSelect.value;
    const variantName = selectedOptionText(variantSelect);
    const city = selectedOptionText(citySelect);

    document.getElementById('resultCarName').textContent = `${makeName} ${modelName} ${variantName}`;
    document.getElementById('resultCarMeta').textContent = `${payload.year} · ${payload.mileage_km.toLocaleString()} km · ${payload.color} · ${city}`;
    document.getElementById('resultConfidence').textContent = `${result.confidence.score}% confidence`;

    const amountEl = document.getElementById('resultAmount');
    animateCounter(amountEl, result.prediction.asking_price_pkr);

    document.getElementById('rangeLow').textContent = `PKR ${formatLakh(result.range.low_pkr)}`;
    document.getElementById('rangeHigh').textContent = `PKR ${formatLakh(result.range.high_pkr)}`;
    document.querySelector('.range-mid-label').textContent = `Deal: PKR ${formatLakh(result.deal.expected_deal_price_pkr)}`;

    updateFactor('factorAge', Math.min(95, Math.max(20, (2026 - payload.year) * 8)), 'Vehicle Age');
    updateFactor('factorMileage', Math.min(95, Math.max(20, payload.mileage_km / 2500)), 'Mileage');
    updateFactor('factorBrand', Math.min(95, Math.max(35, result.confidence.make_model_support_rows / 70)), 'Brand & Model');
    updateFactor('factorCity', payload.registered_in === 'Islamabad' ? 55 : 42, 'Location');

    resultPanel.classList.add('visible');

    trackEvent('price_estimate_result_viewed', {
        make: payload.make,
        model: payload.model,
        variant: payload.variant,
        year: payload.year,
        fuel_type: payload.fuel_type,
        transmission: payload.transmission,
        color: payload.color,
        registration_region: payload.registered_in,
        mileage_bucket: window.MotorGuageAnalytics?.mileageBucket(payload.mileage_km),
        engine_cc: payload.engine_cc,
        predicted_price_pkr: result.prediction.asking_price_pkr,
        predicted_price_bucket: window.MotorGuageAnalytics?.priceBucket(result.prediction.asking_price_pkr),
        range_low_pkr: result.range.low_pkr,
        range_high_pkr: result.range.high_pkr,
        confidence_score: result.confidence.score,
        confidence_label: result.confidence.label,
    });

    setTimeout(() => {
        resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

function updateFactor(id, score, name) {
    const factor = document.getElementById(id);
    if (!factor) return;
    const fill = factor.querySelector('.factor-fill');
    const impact = factor.querySelector('.factor-impact');
    const label = factor.querySelector('.factor-name');
    fill.style.setProperty('--factor-width', `${Math.round(score)}%`);
    impact.textContent = impactLabel(score);
    label.textContent = name;
}

function animateCounter(el, target) {
    const duration = 1100;
    const start = performance.now();
    const formatted = formatLakh(target);

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(target * eased);

        el.textContent = formatLakh(current);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = formatted;
        }
    }

    requestAnimationFrame(update);
}

// ---- Reset ----
resetBtn.addEventListener('click', () => {
    trackEvent('price_estimate_reset');
    form.reset();
    resultPanel.classList.remove('visible');
    progressBar.style.width = '0%';
    colorInput.value = '';
    colorLabel.textContent = 'Select a color';
    colorLabel.style.color = '';
    colorOptions.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));

    resetSelect(modelSelect, 'Select make first');
    resetSelect(variantSelect, 'Select model first');
    resetSelect(fuelSelect, 'Select variant first');
    resetSelect(transmissionSelect, 'Select variant first');

    document.getElementById('estimator').scrollIntoView({ behavior: 'smooth' });
});

// ---- Navbar Scroll Effect ----
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    const currentScroll = window.scrollY;

    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
}, { passive: true });

// ---- Animated Counter (Hero Stats) ----
function animateStatCounters() {
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target);
                const duration = 2000;
                const start = performance.now();

                function updateCount(now) {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const current = Math.round(target * eased);

                    el.textContent = current.toLocaleString();

                    if (progress < 1) {
                        requestAnimationFrame(updateCount);
                    } else {
                        el.textContent = target.toLocaleString();
                    }
                }

                requestAnimationFrame(updateCount);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => observer.observe(el));
}

// ---- Scroll-triggered Fade-in ----
function initScrollAnimations() {
    const elements = document.querySelectorAll('.step-card, .trust-card, .form-card, .section-header');

    elements.forEach(el => el.classList.add('fade-in'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    elements.forEach(el => observer.observe(el));
}

// ---- Background Particles ----
function createParticles() {
    const container = document.getElementById('bgParticles');
    const count = 30;

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 8}s`;
        particle.style.animationDuration = `${6 + Math.random() * 6}s`;
        particle.style.width = `${1 + Math.random() * 2}px`;
        particle.style.height = particle.style.width;
        container.appendChild(particle);
    }
}

// ---- Smooth scroll for anchor links ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    populateMakes();
    populateYears();
    resetSelect(modelSelect, 'Select make first');
    resetSelect(variantSelect, 'Select model first');
    resetSelect(fuelSelect, 'Select variant first');
    resetSelect(transmissionSelect, 'Select variant first');
    createParticles();
    animateStatCounters();
    initScrollAnimations();

    const estimatorSection = document.getElementById('estimator');
    if (estimatorSection) {
        const estimatorObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    trackEvent('estimator_viewed');
                    estimatorObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.25 });
        estimatorObserver.observe(estimatorSection);
    }
});
