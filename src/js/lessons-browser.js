// Loads and renders the maintained swim lesson provider directory.

(async function initializeLessonsBrowser() {
  const providerList = document.getElementById('lessonProviderList');
  const providerStatus = document.getElementById('lessonProviderStatus');
  const relatedProgramList = document.getElementById('relatedProgramList');
  if (!providerList || !providerStatus || !relatedProgramList) return;

  /**
   * Creates a labeled text detail for a lesson card.
   * @param {string} label - Detail label
   * @param {string} value - Detail value
   * @returns {HTMLParagraphElement} Labeled detail element
   * @private
   */
  function createDetail(label, value) {
    const detail = document.createElement('p');
    const heading = document.createElement('strong');
    heading.textContent = `${label}: `;
    detail.append(heading, document.createTextNode(value));
    return detail;
  }

  /**
   * Creates an analytics-labeled link that opens in a new tab.
   * @param {string} label - Visible link label
   * @param {string} url - External destination URL
   * @param {string} purpose - Approved analytics link purpose
   * @returns {HTMLAnchorElement} External link element
   * @private
   */
  function createExternalLink(label, url, purpose) {
    const link = document.createElement('a');
    link.className = 'btn-primary';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.analyticsLinkPurpose = purpose;
    link.append(document.createTextNode(label));
    const newTabText = document.createElement('span');
    newTabText.className = 'visually-hidden';
    newTabText.textContent = ' (opens in new tab)';
    link.append(newTabText);
    return link;
  }

  /**
   * Creates a decorative provider or program logo stage.
   * @param {Object} logo - Normalized logo data
   * @returns {HTMLDivElement} Logo container element
   * @private
   */
  function createLogo(logo) {
    const stage = document.createElement('div');
    stage.className = 'lesson-provider-card__logo';
    const image = document.createElement('img');
    image.src = logo.src;
    image.alt = '';
    image.width = logo.width;
    image.height = logo.height;
    stage.append(image);
    return stage;
  }

  /**
   * Creates the outdoor CA pool lesson comparison section.
   * @param {Object} programs - Normalized outdoor program data
   * @returns {HTMLElement} Outdoor lesson section
   * @private
   */
  function createOutdoorPrograms(programs) {
    const section = document.createElement('section');
    section.className = 'lesson-provider-card__outdoor';
    const sectionHeading = document.createElement('h3');
    sectionHeading.textContent = 'Outdoor Lessons at CA Pools';
    const introduction = document.createElement('p');
    introduction.textContent = 'Compare CA\'s morning camp format and evening lesson series.';
    const options = document.createElement('div');
    options.className = 'lesson-provider-card__outdoor-options';

    programs.options.forEach(option => {
      const item = document.createElement('section');
      item.className = 'lesson-provider-card__outdoor-option';
      const heading = document.createElement('h4');
      heading.textContent = option.name;
      const schedule = createDetail('Schedule', `${option.schedule}; ${option.cadence}`);
      const locations = document.createElement('ul');
      locations.setAttribute('aria-label', `${option.name} locations`);
      option.locations.forEach(location => {
        const locationItem = document.createElement('li');
        const poolName = document.createElement('strong');
        poolName.textContent = location.poolName;
        locationItem.append(poolName, document.createTextNode(`: ${location.days}`));
        locations.append(locationItem);
      });
      item.append(heading, schedule, locations);
      options.append(item);
    });

    const guidance = document.createElement('div');
    guidance.className = 'lesson-provider-card__outdoor-guidance';
    guidance.append(
      createDetail('Please bring', programs.bring.join(', ')),
      createDetail('Weather', programs.weatherPolicy)
    );
    section.append(sectionHeading, introduction, options, guidance);
    return section;
  }

  /**
   * Renders a lesson provider card and optional outdoor-program details.
   * @param {Object} provider - Normalized lesson provider
   * @param {Object|null} outdoorPrograms - Normalized outdoor program data
   * @returns {HTMLElement} Lesson provider card
   * @private
   */
  function renderProvider(provider, outdoorPrograms) {
    const card = document.createElement('article');
    card.className = 'resource-card lesson-provider-card';
    card.dataset.analyticsContext = 'lesson_resources';
    if (outdoorPrograms) card.classList.add('lesson-provider-card--featured');

    const heading = document.createElement('h2');
    heading.textContent = provider.name;
    const details = document.createElement('div');
    details.className = 'lesson-provider-card__details';

    if (provider.contactName && provider.contactEmail) {
      details.append(createDetail('Program contact', provider.contactName));
      const emailLine = document.createElement('p');
      const emailHeading = document.createElement('strong');
      emailHeading.textContent = 'Email: ';
      const emailLink = document.createElement('a');
      emailLink.href = HtmlSafety.safeMailtoUrl(provider.contactEmail);
      emailLink.textContent = provider.contactEmail;
      emailLink.dataset.analyticsLinkPurpose = 'provider_contact';
      emailLine.append(emailHeading, emailLink);
      details.append(emailLine);
    }

    if (provider.phone) {
      const phoneLine = document.createElement('p');
      const phoneHeading = document.createElement('strong');
      phoneHeading.textContent = 'Phone: ';
      const phoneLink = document.createElement('a');
      phoneLink.href = HtmlSafety.safeTelephoneUrl(provider.phone);
      phoneLink.textContent = provider.phone;
      phoneLine.append(phoneHeading, phoneLink);
      details.append(phoneLine);
    }

    const classHeading = document.createElement('h3');
    classHeading.textContent = 'Class Types';
    const classList = document.createElement('ul');
    classList.className = 'lesson-provider-card__classes';
    provider.classTypes.forEach(classType => {
      const item = document.createElement('li');
      item.textContent = classType;
      classList.append(item);
    });

    const actions = document.createElement('div');
    actions.className = 'resource-actions';
    if (outdoorPrograms) {
      actions.append(createExternalLink('View current outdoor classes', outdoorPrograms.registrationUrl, 'provider_website'));
      actions.append(createExternalLink(`Explore ${outdoorPrograms.alternative.name}`, outdoorPrograms.alternative.url, 'provider_website'));
      actions.append(createExternalLink('Review CA outdoor lesson details', outdoorPrograms.sourceUrl, 'provider_website'));
    }
    if (provider.websiteUrl) actions.append(createExternalLink('View lesson information', provider.websiteUrl, 'provider_website'));
    if (provider.contactUrl) actions.append(createExternalLink('Contact provider', provider.contactUrl, 'provider_contact'));

    card.append(createLogo(provider.logo), heading, details, classHeading, classList);
    if (outdoorPrograms) card.append(createOutdoorPrograms(outdoorPrograms));
    card.append(actions);
    return card;
  }

  /**
   * Renders a related aquatic program card.
   * @param {Object} program - Normalized related program
   * @returns {HTMLElement} Related program card
   * @private
   */
  function renderRelatedProgram(program) {
    const card = document.createElement('article');
    card.className = 'resource-card lesson-provider-card';
    card.dataset.analyticsContext = 'lesson_resources';

    const heading = document.createElement('h3');
    heading.textContent = program.name;
    const details = document.createElement('div');
    details.className = 'lesson-provider-card__details';
    details.append(createDetail('Program', program.programType));
    details.append(createDetail('Who can join', program.eligibility));
    details.append(createDetail('Practice setting', program.practiceSetting));
    details.append(createDetail('Summer league', program.summerLeagueFit));

    const highlightsHeading = document.createElement('h4');
    highlightsHeading.textContent = 'Program Highlights';
    const highlights = document.createElement('ul');
    highlights.className = 'lesson-provider-card__highlights';
    program.highlights.forEach(highlight => {
      const item = document.createElement('li');
      item.textContent = highlight;
      highlights.append(item);
    });

    const actions = document.createElement('div');
    actions.className = 'resource-actions';
    actions.append(createExternalLink('Visit official website', program.websiteUrl, 'related_program'));
    actions.append(createExternalLink('Review current eligibility', program.informationUrl, 'related_program'));
    card.append(createLogo(program.logo), heading, details, highlightsHeading, highlights, actions);
    return card;
  }

  try {
    const [documentData, poolsData] = await Promise.all([
      FileHelper.loadJsonFile(FileHelper.getLessonsDataPath()),
      FileHelper.loadJsonFile(FileHelper.getPoolsDataPath())
    ]);
    const providers = LessonProviderService.normalizeDocument(documentData);
    const relatedPrograms = LessonProviderService.normalizeRelatedPrograms(documentData);
    const outdoorPrograms = LessonProviderService.normalizeOutdoorSwimPrograms(documentData, poolsData.pools);
    providers.forEach(provider => providerList.append(renderProvider(
      provider,
      provider.id === 'columbia-association' ? outdoorPrograms : null
    )));
    relatedPrograms.forEach(program => relatedProgramList.append(renderRelatedProgram(program)));
    providerList.setAttribute('aria-busy', 'false');
    providerStatus.textContent = `${providers.length} lesson provider${providers.length === 1 ? '' : 's'} listed.`;
  } catch (error) {
    console.error('[Lessons] Provider directory unavailable:', error);
    providerList.setAttribute('aria-busy', 'false');
    providerStatus.textContent = 'The lesson provider list did not load.';
    const message = document.createElement('p');
    message.textContent = 'The lesson provider list did not load. Please check your connection and refresh the page to try again.';
    providerList.append(message);
  }
}());
