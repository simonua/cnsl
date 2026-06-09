// Loads and renders the maintained swim lesson provider directory.

(async function initializeLessonsBrowser() {
  const providerList = document.getElementById('lessonProviderList');
  const providerStatus = document.getElementById('lessonProviderStatus');
  const relatedProgramList = document.getElementById('relatedProgramList');
  if (!providerList || !providerStatus || !relatedProgramList) return;

  function createDetail(label, value) {
    const detail = document.createElement('p');
    const heading = document.createElement('strong');
    heading.textContent = `${label}: `;
    detail.append(heading, document.createTextNode(value));
    return detail;
  }

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

  function renderProvider(provider) {
    const card = document.createElement('article');
    card.className = 'resource-card lesson-provider-card';
    card.dataset.analyticsContext = 'lesson_resources';

    const heading = document.createElement('h2');
    heading.textContent = provider.name;
    const details = document.createElement('div');
    details.className = 'lesson-provider-card__details';

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
    classHeading.textContent = 'Class types';
    const classList = document.createElement('ul');
    classList.className = 'lesson-provider-card__classes';
    provider.classTypes.forEach(classType => {
      const item = document.createElement('li');
      item.textContent = classType;
      classList.append(item);
    });

    const actions = document.createElement('div');
    actions.className = 'resource-actions';
    if (provider.websiteUrl) actions.append(createExternalLink('View lesson information', provider.websiteUrl, 'provider_website'));
    if (provider.contactUrl) actions.append(createExternalLink('Contact provider', provider.contactUrl, 'provider_contact'));

    card.append(createLogo(provider.logo), heading, details, classHeading, classList, actions);
    return card;
  }

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
    highlightsHeading.textContent = 'Program highlights';
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
    const documentData = await FileHelper.loadJsonFile(FileHelper.getLessonsDataPath());
    const providers = LessonProviderService.normalizeDocument(documentData);
    const relatedPrograms = LessonProviderService.normalizeRelatedPrograms(documentData);
    providers.forEach(provider => providerList.append(renderProvider(provider)));
    relatedPrograms.forEach(program => relatedProgramList.append(renderRelatedProgram(program)));
    providerList.setAttribute('aria-busy', 'false');
    providerStatus.textContent = `${providers.length} lesson provider${providers.length === 1 ? '' : 's'} listed.`;
  } catch (error) {
    console.error('[Lessons] Provider directory unavailable:', error);
    providerList.setAttribute('aria-busy', 'false');
    providerStatus.textContent = 'Lesson provider information is currently unavailable.';
    const message = document.createElement('p');
    message.textContent = 'Lesson provider information is currently unavailable. Please try again later.';
    providerList.append(message);
  }
}());