/* ==========================================
   ReloPlan - Relocation Logic Controller
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const calcForm = document.getElementById('calculator-form');
  const originInputs = document.querySelectorAll('input[name="origin-city"]');
  const destinationInputs = document.querySelectorAll('input[name="destination-region"]');
  const familyInputs = document.querySelectorAll('input[name="family-size"]');
  const housingInputs = document.querySelectorAll('input[name="housing-type"]');
  const addonCheckboxes = document.querySelectorAll('input[name="calc-addon"]');

  // Summary elements
  const summarySetup = document.getElementById('summary-setup');
  const summaryRent = document.getElementById('summary-rent');
  const summaryInsurance = document.getElementById('summary-insurance');
  const summaryVisa = document.getElementById('summary-visa');
  const summaryEducation = document.getElementById('summary-education');
  const summaryPet = document.getElementById('summary-pet');
  const initialBudgetEl = document.getElementById('initial-budget');
  const monthlyRunningEl = document.getElementById('monthly-running');
  const generateRoadmapBtn = document.getElementById('generate-roadmap-btn');

  // Roadmap & Handoff elements
  const roadmapSection = document.getElementById('roadmap');
  const roadmapTimelineContainer = document.getElementById('roadmap-timeline-container');
  const leadProfileInput = document.getElementById('lead-profile-input');
  const leadBudgetInput = document.getElementById('lead-budget-input');
  const clientMessageTextarea = document.getElementById('client-message');
  const leadForm = document.getElementById('lead-form');
  const clientNameInput = document.getElementById('client-name');
  const moveDateInput = document.getElementById('move-date-input');
  
  // Dialogs
  const successDialog = document.getElementById('success-dialog');
  const closeDialogBtn = document.getElementById('close-dialog-btn');
  const contributeBtn = document.getElementById('contribute-data-btn');
  const contribDialog = document.getElementById('contribution-dialog');
  const closeContribBtn = document.getElementById('close-contrib-btn');
  const contribForm = document.getElementById('contribution-form');

  // Mobile nav elements
  const navToggle = document.querySelector('.nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  // --- Relocation Pricing Matrices ---
  let SHIPPING_ESTIMATES_TABLE = {
    single: {
      t1: { low: 1500, high: 3500 },
      t3: { low: 3500, high: 5500 },
      villa: { low: 5500, high: 8500 }
    },
    couple: {
      t1: { low: 3500, high: 5500 },
      t3: { low: 5500, high: 8500 },
      villa: { low: 7000, high: 12000 }
    },
    family: {
      t1: { low: 5500, high: 8500 },
      t3: { low: 7000, high: 12000 },
      villa: { low: 8500, high: 14000 }
    }
  };

  let RENT_MATRIX = {
    lisbon: { t1: 1200, t3: 2200, villa: 3800 },
    porto: { t1: 900, t3: 1600, villa: 2800 },
    algarve: { t1: 950, t3: 1750, villa: 3200 }
  };

  let HEALTH_INSURANCE = {
    single: 63,
    couple: 126,
    family: 220
  };

  let VISA_PROCESSING = {
    single: 450,
    couple: 750,
    family: 1200
  };

  const LIVING_BASES = {
    lisbon: { single: 1200, couple: 1800, family: 2500 },
    porto: { single: 950, couple: 1450, family: 2000 },
    algarve: { single: 1050, couple: 1600, family: 2200 }
  };

  let petDiyCost = 903; // default fallback
  let intlSchoolAddonCost = 1217; // non-boarding schools average monthly fee ($146,000 / 10 / 12 = $1,217/mo)

  // --- Current Relocation State ---
  let state = {
    origin: 'nyc',
    destination: 'lisbon',
    familySize: 'single',
    housing: 't1',
    internationalSchool: false,
    fullShipping: false,
    petRelocation: true,
    
    // Outputs
    setupCost: 2500,
    rentCost: 2275,
    insuranceCost: 55,
    visaCost: 450,
    petCost: 0,
    initialBudget: 4850,
    monthlyRunning: 2480
  };

  // --- Math Logic ---
  function recalculateRelocation() {
    // 1. Setup Shipping Costs (Average calculation based on exact Family Size + Property Size matching shipping-report.html)
    const range = (SHIPPING_ESTIMATES_TABLE[state.familySize] && SHIPPING_ESTIMATES_TABLE[state.familySize][state.housing]) || { low: 1500, high: 3500 };
    const avgShipping = Math.round((range.low + range.high) / 2);
    const shippingAddon = state.fullShipping ? 2500 : 0;
    state.setupCost = avgShipping + shippingAddon;

    // Subtext display: Based on: [Family Size] + [Property Size]
    const familyLabels = { single: 'Single Expat', couple: 'Couple', family: 'Family' };
    const housingLabels = { t1: 'T1/T2', t3: 'T3', villa: 'Detached Villa' };
    const setupSubtextEl = document.getElementById('summary-setup-subtext');
    if (setupSubtextEl) {
      setupSubtextEl.textContent = `Based on: ${familyLabels[state.familySize]} + ${housingLabels[state.housing]}`;
    }

    // 2. Rent Cost
    state.rentCost = RENT_MATRIX[state.destination][state.housing] || 2275;
 
    // 3. Health Insurance
    state.insuranceCost = HEALTH_INSURANCE[state.familySize];
    const familyLabelsFull = { single: 'Single Expat', couple: 'Couple', family: 'Family (3-4)' };
    const insuranceSubtextEl = document.getElementById('summary-insurance-subtext');
    if (insuranceSubtextEl) {
      insuranceSubtextEl.textContent = `Basic services for ${familyLabelsFull[state.familySize]}`;
    }
 
    // 4. Visa & Admin Processing
    state.visaCost = VISA_PROCESSING[state.familySize];
 
    // 5. Monthly Running Costs (Rent + Cost of Living + Optional International Schooling)
    const baseLiving = LIVING_BASES[state.destination][state.familySize];
    const schoolingAddon = state.internationalSchool ? intlSchoolAddonCost : 0;
    state.monthlyRunning = state.rentCost + baseLiving + state.insuranceCost + schoolingAddon;

    // 6. Pet Cost (DIY average calculated dynamically from pet-report.html: ($605 + $1,200) / 2 = $903)
    state.petCost = state.petRelocation ? petDiyCost : 0;

    // 7. Initial Relocation Capital (Shipping + Visa fees + 1st Month Rent + 1 Month Deposit + Pet Cost)
    state.initialBudget = state.setupCost + state.visaCost + (state.rentCost * 2) + state.petCost;

    // 8. Update UI elements
    summarySetup.textContent = `$${state.setupCost.toLocaleString()}`;
    summaryRent.textContent = `$${state.rentCost.toLocaleString()}/mo`;
    summaryInsurance.textContent = `$${state.insuranceCost.toLocaleString()}/mo`;
    summaryVisa.textContent = `$${state.visaCost.toLocaleString()}`;
    summaryEducation.textContent = state.internationalSchool ? `$${intlSchoolAddonCost.toLocaleString()}/mo` : "$0/mo";
    if (summaryPet) {
      summaryPet.textContent = state.petRelocation ? `$${state.petCost.toLocaleString()}` : "$0";
    }
    
    initialBudgetEl.textContent = `$${state.initialBudget.toLocaleString()}`;
    monthlyRunningEl.textContent = `$${state.monthlyRunning.toLocaleString()}/mo`;
  }

  // --- Input Change Handlers ---
  function attachControlListeners() {
    const bindEvents = (elementList, updateFn) => {
      elementList.forEach(el => {
        el.addEventListener('change', updateFn);
        el.addEventListener('input', updateFn);
        el.addEventListener('click', updateFn);
      });
    };

    bindEvents(originInputs, (e) => {
      state.origin = e.target.value;
      recalculateRelocation();
    });

    bindEvents(destinationInputs, (e) => {
      state.destination = e.target.value;
      recalculateRelocation();
    });

    bindEvents(familyInputs, (e) => {
      state.familySize = e.target.value;
      recalculateRelocation();
    });

    bindEvents(housingInputs, (e) => {
      state.housing = e.target.value;
      recalculateRelocation();
    });

    bindEvents(addonCheckboxes, (e) => {
      const isChecked = e.target.checked;
      if (e.target.value === 'international-school') {
        state.internationalSchool = isChecked;
      } else if (e.target.value === 'full-shipping') {
        state.fullShipping = isChecked;
      } else if (e.target.value === 'pet-relocation') {
        state.petRelocation = isChecked;
      }
      recalculateRelocation();
    });
  }

  // --- Roadmap Actions Generator ---
  function renderRoadmapTimeline() {
    if (!moveDateInput || !roadmapTimelineContainer) return;
    
    if (!moveDateInput.value) {
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 6);
      moveDateInput.value = defaultDate.toISOString().split('T')[0];
    }

    const originLabel = state.origin === 'nyc' ? 'New York' : (state.origin === 'sfo' ? 'San Francisco' : 'Austin');
    const destLabel = state.destination === 'lisbon' ? 'Lisbon Metro' : (state.destination === 'porto' ? 'Porto / North' : 'Algarve Coast');
    const sizeLabel = state.familySize.charAt(0).toUpperCase() + state.familySize.slice(1);
    const housingLabel = state.housing === 't1' ? 'T1/T2 Apartment' : (state.housing === 't3' ? 'T3 Flat' : 'Detached Villa');

    if (leadProfileInput) leadProfileInput.value = `${originLabel} to ${destLabel} (${sizeLabel})`;
    if (leadBudgetInput) leadBudgetInput.value = `Est: $${state.initialBudget.toLocaleString()} Setup / $${state.monthlyRunning.toLocaleString()}/mo`;

    const tasks = [
      {
        title: 'Acquire Portuguese NIF (<a href="visa-report.html#visa-resources" target="_blank" class="insurance-report-link">Tax Number</a>)',
        desc: 'Request a NIF via an online fiscal representative. This is the foundation for all contracts, lease agreements, and bank setups.'
      },
      {
        title: '<a href="https://anchorless.io/portugal" target="_blank" rel="noopener" class="insurance-report-link">Open Portuguese Bank Account</a>',
        desc: `Deposit minimum qualifying funds. For a ${sizeLabel} profile, we recommend depositing at least €12,000 to demonstrate self-sufficiency to VFS.`
      },
      {
        title: 'Secure <a href="rent-report.html" target="_blank" class="insurance-report-link">Accommodation</a> Agreement',
        desc: `Secure a 1-year registered rental contract (or deed) for a ${housingLabel} in ${destLabel}. This proof of housing is mandatory for the visa interview.`
      },
      {
        title: 'Expat <a href="insurance-report.html" target="_blank" class="insurance-report-link">Health Insurance</a> Activation',
        desc: `Purchase private health insurance covering Portugal (approx. €${Math.round(state.insuranceCost * 0.9)}/mo). Coverage must begin before visa submission.`
      },
      {
        title: '<a href="visa-report.html#visa-resources" target="_blank" class="insurance-report-link">Visa Dossier Submission</a> at VFS (US)',
        desc: `Attend your VFS appointment in the US (nearest hub to ${originLabel}). Present NIF, bank balance, lease, and health insurance certificates.`,
        durationMonths: 2
      },
      {
        title: 'Lock <a href="shipping-report.html" target="_blank" class="insurance-report-link">Movers & Relocation Logistics</a>',
        desc: `Finalize shipping logistics (estimated setup: $${state.setupCost.toLocaleString()}). Vessel cargo takes 6-8 weeks to arrive in Portugal ports. Looking for more information or simply assistance in your visa applications? <a href="visa-report.html#visa-resources" target="_blank" style="text-decoration: underline; color: inherit;">Bordr</a> and <a href="visa-report.html#visa-resources" target="_blank" style="text-decoration: underline; color: inherit;">Anchorless</a> offer excellent resources, offering reliable guidance, practical advice, and up-to-date information to help you plan your move with confidence.`
      },
      {
        title: '<a href="visa-report.html#visa-resources" target="_blank" class="insurance-report-link">Immigration Appointment</a> in Portugal',
        desc: 'Attend your local appointment to register your biometrics and receive your definitive residence card.'
      }
    ];

    if (state.petRelocation) {
      tasks.splice(3, 0, {
        title: '<a href="pet-report.html" target="_blank" class="insurance-report-link">Pet Microchip, Rabies Vaccine & Pet Carrier</a>',
        desc: 'Implant ISO-compliant 15-digit microchip, administer rabies vaccination, and begin travel crate acclimation training.'
      });
      tasks.push({
        title: '<a href="pet-report.html#usda-endorsement" target="_blank" class="insurance-report-link">USDA Endorsement & Portuguese Border Notification</a>',
        desc: 'Obtain accredited vet check, secure USDA electronic endorsement within 10 days of flight, and notify DGAV vet post 48h before arrival.'
      });
    }

    roadmapTimelineContainer.innerHTML = '';

    // Calculate cumulative months backward for each task
    const cumulativeMonths = new Array(tasks.length).fill(0);
    let currentOffset = 0;
    for (let i = tasks.length - 1; i >= 0; i--) {
      if (tasks[i].durationMonths) {
        currentOffset += tasks[i].durationMonths - 1;
      }
      cumulativeMonths[i] = currentOffset;
      currentOffset += 1;
    }

    tasks.forEach((task, index) => {
      const monthsToGoBack = cumulativeMonths[index];
      let baseDate = new Date(moveDateInput.value + 'T00:00:00');
      
      if (task.title.includes('Movers & Relocation Logistics') || task.title.includes('USDA Endorsement & Portuguese Border Notification')) {
        baseDate.setDate(baseDate.getDate() - 2);
      } else {
        baseDate.setMonth(baseDate.getMonth() - monthsToGoBack);
      }
      
      const formattedDate = baseDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      
      const node = document.createElement('div');
      node.className = 'timeline-node';
      node.innerHTML = `
        <div class="node-dot"></div>
        <div class="node-content">
          <div class="node-header">
            <input type="checkbox" id="task-chk-${index}" class="task-checkbox" style="margin-right: 8px; cursor: pointer;">
            <label for="task-chk-${index}"><h4>${task.title}</h4></label>
            <span class="node-time">Stage Completion target date: ${formattedDate}</span>
          </div>
          <p class="node-desc">${task.desc}</p>
        </div>
      `;
      
      const checkbox = node.querySelector('.task-checkbox');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          node.classList.add('completed');
        } else {
          node.classList.remove('completed');
        }
      });

      roadmapTimelineContainer.appendChild(node);
    });
    // Write customized query message in contact form
    const messageDraft = `Hello ReloPlan Team,

I've generated my relocation profile from ${originLabel} to ${destLabel} (${sizeLabel} household).
- Target Housing: ${housingLabel}
- Target Move Date: ${moveDateInput && moveDateInput.value ? moveDateInput.value : 'Not set'}
- Shipping Base: ${state.fullShipping ? 'Full Sea Container' : 'Standard Flight/Box Allowance'}
- School Type: ${state.internationalSchool ? 'Private English Schooling Required' : 'None / Public'}

My estimated initial setup investment is $${state.initialBudget.toLocaleString()} with a monthly operating cost of $${state.monthlyRunning.toLocaleString()}/mo.

I would like to be connected to vetted moving companies and visa legal experts to verify NIF and lease pathways.`;

    if (clientMessageTextarea) clientMessageTextarea.value = messageDraft;
  }

  if (generateRoadmapBtn) {
    generateRoadmapBtn.addEventListener('click', () => {
      if (roadmapSection) roadmapSection.classList.remove('hidden-section');
      renderRoadmapTimeline();
      if (roadmapSection) roadmapSection.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (moveDateInput) {
    moveDateInput.addEventListener('change', renderRoadmapTimeline);
    moveDateInput.addEventListener('input', renderRoadmapTimeline);
  }

  // --- Lead Form & Success Modal Handler ---
  if (leadForm) {
    leadForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const requiredFields = leadForm.querySelectorAll('input[required], textarea[required]');
      let formIsValid = true;
      let firstInvalid = null;

      requiredFields.forEach(field => {
        if (!field.checkValidity()) {
          formIsValid = false;
          if (!firstInvalid) firstInvalid = field;
        }
      });

      if (formIsValid && successDialog) {
        successDialog.showModal();
      } else if (firstInvalid) {
        firstInvalid.focus();
      }
    });
  }

  if (closeDialogBtn) {
    closeDialogBtn.addEventListener('click', () => {
      if (successDialog) successDialog.close();
      if (leadForm) leadForm.reset();
      if (calcForm) calcForm.reset();
      
      // Hide roadmap again
      if (roadmapSection) roadmapSection.classList.add('hidden-section');
      
      // Reset state
      state = {
        origin: 'nyc',
        destination: 'lisbon',
        familySize: 'single',
        housing: 't1',
        internationalSchool: false,
        fullShipping: false,
        petRelocation: false,
        setupCost: 7150,
        rentCost: 2275,
        insuranceCost: 55,
        visaCost: 450,
        petCost: 0,
        initialBudget: 4850,
        monthlyRunning: 2480
      };
      recalculateRelocation();
    });
  }

  if (successDialog) {
    successDialog.addEventListener('cancel', () => {
      if (leadForm) leadForm.reset();
      if (calcForm) calcForm.reset();
      if (roadmapSection) roadmapSection.classList.add('hidden-section');
      recalculateRelocation();
    });
  }

  // --- Flywheel Data Submission Simulation ---
  if (contributeBtn && contribDialog) {
    contributeBtn.addEventListener('click', () => {
      contribDialog.showModal();
    });
  }

  if (closeContribBtn && contribDialog) {
    closeContribBtn.addEventListener('click', () => {
      contribDialog.close();
    });
  }

  if (contribForm && contribDialog) {
    contribForm.addEventListener('submit', (e) => {
      e.preventDefault();
      contribDialog.close();
      alert('Thank you! Your rental contribution has been queued for verification by local coordinators.');
      contribForm.reset();
    });
  }

  // --- Mobile Menu Toggle handling ---
  if (mobileMenu && navToggle) {
    mobileMenu.addEventListener('toggle', (event) => {
      if (event.newState === 'open') {
        navToggle.setAttribute('aria-expanded', 'true');
      } else {
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Load dynamic rent data from JSON database
  async function loadDynamicRentData() {
    try {
      const response = await fetch('/rent-data.json');
      const data = await response.json();
      if (data && data.regions) {
        RENT_MATRIX = {
          lisbon: {
            t1: data.regions.lisbon.t1.medium,
            t3: data.regions.lisbon.t3.medium,
            villa: data.regions.lisbon.villa.medium
          },
          porto: {
            t1: data.regions.porto.t1.medium,
            t3: data.regions.porto.t3.medium,
            villa: data.regions.porto.villa.medium
          },
          algarve: {
            t1: data.regions.algarve.t1.medium,
            t3: data.regions.algarve.t3.medium,
            villa: data.regions.algarve.villa.medium
          }
        };
        recalculateRelocation();
      }
    } catch (e) {
      console.warn("Could not load dynamic rent data, falling back to defaults:", e);
    }
  }

  // Load dynamic visa data from JSON database
  async function loadDynamicVisaData() {
    try {
      const response = await fetch('/visa-data.json');
      const data = await response.json();
      if (data && data.fees) {
        VISA_PROCESSING = {
          single: data.fees.single,
          couple: data.fees.couple,
          family: data.fees.family
        };
        recalculateRelocation();
      }
    } catch (e) {
      console.warn("Could not load dynamic visa data, falling back to defaults:", e);
    }
  }

  // Load dynamic pet relocation costs from pet-report.html
  async function loadPetReportData() {
    try {
      const response = await fetch('pet-report.html');
      const htmlText = await response.text();
      if (htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const rows = doc.querySelectorAll('table tbody tr');
        let totalRow = null;
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length > 0 && cells[0].textContent.includes('Estimated Total')) {
            totalRow = row;
          }
        });

        if (totalRow) {
          const cells = totalRow.querySelectorAll('td');
          const diyText = cells[1].textContent; // e.g. "$605 – $1,200"
          const numbers = diyText.match(/\d+[\d,._]*/g);
          if (numbers && numbers.length >= 2) {
            const lower = parseInt(numbers[0].replace(/,/g, ''));
            const upper = parseInt(numbers[1].replace(/,/g, ''));
            petDiyCost = Math.round((lower + upper) / 2);
            recalculateRelocation();
          }
        }
      }
    } catch (e) {
      console.warn("Could not load dynamic pet report data, falling back to default:", e);
    }
  }

  // Load dynamic education school fees from education-data.json for all non-boarding schools
  async function loadEducationReportSchoolData() {
    try {
      const response = await fetch('/education-data.json');
      const data = await response.json();
      if (data && data.schools) {
        // Filter for all schools listed that do not include boarding
        const nonBoardingSchools = data.schools.filter(s => !s.boarding && s.type !== 'boarding');
        let totalFeeSum = 0;
        let feeCount = 0;

        nonBoardingSchools.forEach(school => {
          if (school.fees) {
            const numbers = school.fees.match(/\d+[\d,._]*/g);
            if (numbers && numbers.length >= 2) {
              const lower = parseInt(numbers[0].replace(/,/g, ''), 10);
              const upper = parseInt(numbers[1].replace(/,/g, ''), 10);
              totalFeeSum += (lower + upper);
              feeCount += 2;
            }
          }
        });

        if (feeCount > 0) {
          const averageAnnual = totalFeeSum / feeCount;
          intlSchoolAddonCost = Math.round(averageAnnual / 12);
          recalculateRelocation();
        }
      }
    } catch (e) {
      console.warn("Could not load dynamic education school data:", e);
    }
  }

  // Load dynamic shipping costs from shipping-report.html table
  async function loadShippingReportData() {
    try {
      const response = await fetch('shipping-report.html');
      const htmlText = await response.text();
      if (htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const rows = doc.querySelectorAll('table tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const profileText = cells[0].textContent; // e.g. "Single Expat + T1/T2"
            const costText = cells[2].textContent; // e.g. "$1,500 – $3,500"
            const numbers = costText.match(/\d+[\d,._]*/g);
            if (numbers && numbers.length >= 2) {
              const low = parseInt(numbers[0].replace(/,/g, ''));
              const high = parseInt(numbers[1].replace(/,/g, ''));
              
              let famKey = null;
              if (profileText.includes('Single Expat')) famKey = 'single';
              else if (profileText.includes('Couple')) famKey = 'couple';
              else if (profileText.includes('Family')) famKey = 'family';

              let housingKey = null;
              if (profileText.includes('T1/T2')) housingKey = 't1';
              else if (profileText.includes('T3')) housingKey = 't3';
              else if (profileText.includes('Villa')) housingKey = 'villa';

              if (famKey && housingKey && SHIPPING_ESTIMATES_TABLE[famKey]) {
                SHIPPING_ESTIMATES_TABLE[famKey][housingKey] = { low, high };
              }
            }
          }
        });
        recalculateRelocation();
      }
    } catch (e) {
      console.warn("Could not load dynamic shipping report data, using defaults:", e);
    }
  }

  // Load dynamic health insurance premiums from insurance-report.html table
  async function loadInsuranceReportData() {
    try {
      const response = await fetch('insurance-report.html');
      const htmlText = await response.text();
      if (htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const rows = doc.querySelectorAll('table tbody tr');
        
        const individualRates = [];
        const familyRates = [];

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const tariffText = cells[1].textContent;
            const indMatch = tariffText.match(/Individual\s*\(Age\s*35\):\s*\$(\d+)/i);
            if (indMatch && indMatch[1]) {
              individualRates.push(parseInt(indMatch[1], 10));
            }
            const famMatch = tariffText.match(/Family\s*of\s*4:\s*\$(\d+)/i);
            if (famMatch && famMatch[1]) {
              familyRates.push(parseInt(famMatch[1], 10));
            }
          }
        });

        if (individualRates.length > 0) {
          const minIndividual = Math.min(...individualRates);
          HEALTH_INSURANCE.single = minIndividual;
          HEALTH_INSURANCE.couple = minIndividual * 2;
        }

        if (familyRates.length > 0) {
          const minFamily = Math.min(...familyRates);
          HEALTH_INSURANCE.family = minFamily;
        }

        recalculateRelocation();
      }
    } catch (e) {
      console.warn("Could not load dynamic insurance report data, using defaults:", e);
    }
  }

  // --- Run First Estimate Calc ---
  attachControlListeners();
  loadDynamicRentData();
  loadDynamicVisaData();
  loadPetReportData();
  loadEducationReportSchoolData();
  loadShippingReportData();
  loadInsuranceReportData();
  recalculateRelocation();
});
