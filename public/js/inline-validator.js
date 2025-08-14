// Simple inline error injector
// Expected server JSON shape: { success?: false, errors: { fieldName: [msg, ...] } }
window.attachInlineValidation = function attachInlineValidation(form) {
  if (!form) return;
  form.addEventListener('submit', async function (e) {
    // If caller already prevented default, skip
    if (e.defaultPrevented) return;
    e.preventDefault();
    // Clear errors
    clearErrors(form);

    const formData = new URLSearchParams();
    new FormData(form).forEach((v, k) => formData.append(k, v));

    const method = (form.getAttribute('method') || 'POST').toUpperCase();
    const action = form.getAttribute('action') || window.location.href;

    const res = await fetch(action, {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      },
      body: formData.toString()
    });

    if (res.ok) {
      // On success follow redirect or reload
      const locationHeader = res.headers.get('X-Redirect-To');
      if (locationHeader) {
        window.location.href = locationHeader;
      } else {
        window.location.reload();
      }
      return;
    }

    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (data && data.errors) {
      showErrors(form, data.errors);
      return;
    }
    // Fallback
    alert('Submission failed');
  });
};

function showErrors(form, errors) {
  Object.keys(errors).forEach((fieldName) => {
    const messages = Array.isArray(errors[fieldName]) ? errors[fieldName] : [String(errors[fieldName])];
    const input = form.querySelector(`[name="${CSS.escape(fieldName)}"]`);
    if (!input) return;

    // Prefer to place the error at the top of the field, right under its label
    let container = input.closest('div') || form;
    let errEl = null;

    // Try to find label associated with this input
    const inputId = input.getAttribute('id');
    let labelEl = null;
    if (inputId) {
      labelEl = container.querySelector(`label[for="${CSS.escape(inputId)}"]`);
    }
    if (!labelEl) {
      // Fallback: previous sibling label
      const prev = input.previousElementSibling;
      if (prev && prev.tagName === 'LABEL') labelEl = prev;
    }

    // Reuse existing error node if present in the container
    errEl = container.querySelector('.field-error[data-for="' + fieldName + '"]');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'field-error mt-1 text-sm text-red-600';
      errEl.setAttribute('data-for', fieldName);
      if (labelEl && labelEl.nextSibling) {
        labelEl.insertAdjacentElement('afterend', errEl);
      } else if (labelEl) {
        labelEl.parentNode.insertBefore(errEl, labelEl.nextSibling);
      } else {
        // As a last resort, insert before the input
        input.insertAdjacentElement('beforebegin', errEl);
      }
    }
    errEl.textContent = messages[0];
  });
}

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
}

