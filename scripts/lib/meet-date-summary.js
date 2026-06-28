const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HTML_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => HTML_ESCAPES[character]);
}

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Meet date summary requires ${fieldName}.`);
  }
  return value.trim();
}

function requireDate(value) {
  const dateValue = requireText(value, 'a meet date');
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (!DATE_PATTERN.test(dateValue) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateValue) {
    throw new Error(`Meet date summary requires a valid meet date: ${dateValue}.`);
  }
  return dateValue;
}

function formatDateLabel(dateValue) {
  return new Date(`${dateValue}T00:00:00Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric'
  });
}

function createMeetDateCardNode({ dateLabel, dateValue, meetName }) {
  const detailsId = `meet-details-${dateValue}`;
  const isTemplate = dateValue === 'template';
  return {
    tag: 'article',
    attrs: {
      class: 'meet-date-card collapsed',
      'data-analytics-context': 'meet_details',
      'data-meet-card': '',
      'data-meet-date': dateValue,
      ...(isTemplate ? {} : { id: `meet-date-${dateValue}` })
    },
    content: [
      {
        tag: 'div',
        attrs: { class: 'meet-date-header', 'data-meet-card-header': '' },
        content: [
          {
            tag: 'div',
            attrs: { class: 'date-and-name' },
            content: [
              {
                tag: 'h2',
                content: [{
                  tag: 'button',
                  attrs: {
                    'aria-controls': detailsId,
                    'aria-expanded': 'false',
                    class: 'meet-date-header__toggle',
                    'data-meet-card-action': 'toggle',
                    type: 'button'
                  },
                  content: [{
                    tag: 'time',
                    attrs: isTemplate ? {} : { datetime: dateValue },
                    content: dateLabel ? [dateLabel] : []
                  }]
                }]
              },
              {
                tag: 'span',
                attrs: { class: 'meet-name-header' },
                content: meetName ? [meetName] : []
              }
            ]
          },
          { tag: 'div', attrs: { class: 'status-container' } }
        ]
      },
      {
        tag: 'div',
        attrs: {
          'aria-busy': 'false',
          class: 'meet-date-details',
          'data-meet-details-hydrated': 'false',
          hidden: '',
          id: detailsId
        }
      }
    ]
  };
}

function createMeetDateSummaryNode(meetsDocument) {
  const regularMeets = Array.isArray(meetsDocument?.regular_meets) ? meetsDocument.regular_meets : [];
  const specialMeets = Array.isArray(meetsDocument?.special_meets) ? meetsDocument.special_meets : [];
  const groupedMeets = new Map();

  [...regularMeets, ...specialMeets].forEach(meet => {
    const dateValue = requireDate(meet?.date);
    const meetName = requireText(meet?.name, `a meet name for ${dateValue}`);
    if (!groupedMeets.has(dateValue)) groupedMeets.set(dateValue, meetName);
  });

  const cards = [...groupedMeets.entries()]
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([dateValue, meetName]) => createMeetDateCardNode({
      dateLabel: formatDateLabel(dateValue),
      dateValue,
      meetName: escapeHtml(meetName)
    }));

  if (cards.length === 0) {
    throw new Error('Meet date summary requires at least one published meet.');
  }

  return {
    tag: false,
    content: [
      ...cards,
      {
        tag: 'template',
        attrs: { id: 'meetDateCardTemplate' },
        content: [createMeetDateCardNode({ dateLabel: '', dateValue: 'template', meetName: '' })]
      }
    ]
  };
}

module.exports = { createMeetDateSummaryNode };
