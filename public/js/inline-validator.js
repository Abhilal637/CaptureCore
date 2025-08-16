window.attachInlineValidation = function attachInlineValidation(form) {
  if (!form) return;

  form.querySelectorAll('input, textarea, select').forEach(input => {
    input.removeAttribute('required');
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors(form);

    const isValid = validateAllFields(form);
    if (!isValid) return false;

    const isAjax =
      form.hasAttribute('data-ajax') ||
      form.querySelector('input[name="ajax"]')?.value === 'true';

    if (isAjax) {
      await handleAjaxSubmission(form);
    } else {
      await handleTraditionalSubmission(form);
    }
  });

  form.querySelectorAll('input, textarea, select').forEach(input => {
    input.addEventListener('blur', function () {
      validateField(this);
    });

    input.addEventListener('input', function () {
      clearFieldError(this);
    });
  });
};

function validateAllFields(form) {
  let isValid = true;
  form.querySelectorAll('input, textarea, select').forEach(input => {
    if (!validateField(input)) {
      isValid = false;
    }
  });
  return isValid;
}

async function handleAjaxSubmission(form) {
  const formData = new URLSearchParams();
  new FormData(form).forEach((v, k) => formData.append(k, v));

  const method = (form.getAttribute('method') || 'POST').toUpperCase();
  const action = form.getAttribute('action') || window.location.href;

  try {
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
      const locationHeader = res.headers.get('X-Redirect-To');
      if (locationHeader) {
        window.location.href = locationHeader;
      } else {
        window.location.reload();
      }
      return;
    }

    let data = null;
    try { data = await res.json(); } catch (_) { }
    if (data && data.errors) {
      showErrors(form, data.errors);
      return;
    }

    alert('Submission failed');
  } catch (error) {
    console.error('Error:', error);
    alert('Network error. Please try again.');
  }
}

async function handleTraditionalSubmission(form) {
  const formData = new FormData(form);
  const method = (form.getAttribute('method') || 'POST').toUpperCase();
  const action = form.getAttribute('action') || window.location.href;

  try {
    const res = await fetch(action, {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html'
      },
      body: new URLSearchParams(formData).toString()
    });

    if (res.ok) {
      form.removeEventListener('submit', arguments.callee);
      form.submit();
      return;
    }

    const html = await res.text();
    const errors = extractValidationErrors(html);

    if (errors && Object.keys(errors).length > 0) {
      showErrors(form, errors);
    } else {
      form.removeEventListener('submit', arguments.callee);
      form.submit();
    }
  } catch (error) {
    console.error('Error:', error);
    form.removeEventListener('submit', arguments.callee);
    form.submit();
  }
}

function extractValidationErrors(html) {
  const errors = {};
  const errorPatterns = [
    /<span[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/span>/gi,
    /<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/div>/gi,
    /<p[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/p>/gi,
    /<li[^>]*class="[^"]*error[^"]*"[^>]*>([^<]+)<\/li>/gi
  ];

  errorPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const errorMessage = match[1].trim();
      const fieldMatch = errorMessage.match(/^([^:]+):\s*(.+)$/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1].toLowerCase().replace(/\s+/g, '');
        const message = fieldMatch[2];
        if (!errors[fieldName]) errors[fieldName] = [];
        errors[fieldName].push(message);
      }
    }
  });

  return errors;
}

function validateField(input) {
  const fieldName = input.name;
  if (!fieldName) return true;

  const value = input.value.trim();
  const fieldType = input.type;

  const shouldBeRequired =
    input.hasAttribute('data-required') ||
    input.hasAttribute('minlength') ||
    fieldType === 'email' ||
    fieldType === 'password';

  clearFieldError(input);

  if (shouldBeRequired && !value) {
    showFieldError(input, `${getFieldLabel(input)} is required.`);
    return false;
  }

  if (value) {
    let isValid = true;
    let errorMessage = '';

    if (fieldName === 'phone') {
      if (!/^\d{10}$/.test(value)) {
        isValid = false;
        errorMessage = 'Phone number must be exactly 10 digits.';
      } else if (/^(\d)\1{9}$/.test(value)) {
        isValid = false;
        errorMessage = 'Phone number cannot have all digits the same.';
      }
    } else if (fieldName === 'pincode') {
      if (!/^\d{6}$/.test(value)) {
        isValid = false;
        errorMessage = 'Pincode must be exactly 6 digits.';
      }
    } else {
      switch (fieldType) {
        case 'email':
          if (!isValidEmail(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address.';
          }
          break;
        case 'tel':
          if (!isValidPhone(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number.';
          }
          break;
        case 'password':
          if (
            input.minLength &&
            parseInt(input.minLength) > 0 &&
            value.length < parseInt(input.minLength)
          ) {
            isValid = false;
            errorMessage = `Password must be at least ${input.minLength} characters long.`;
          }
          break;
        default:
          if (
            input.minLength &&
            parseInt(input.minLength) > 0 &&
            value.length < parseInt(input.minLength)
          ) {
            isValid = false;
            errorMessage = `${getFieldLabel(input)} must be at least ${input.minLength} characters.`;
          }
          if (
            input.maxLength &&
            parseInt(input.maxLength) > 0 &&
            value.length > parseInt(input.maxLength)
          ) {
            isValid = false;
            errorMessage = `${getFieldLabel(input)} must not exceed ${input.maxLength} characters.`;
          }
      }
    }

    if (!isValid) {
      showFieldError(input, errorMessage);
      return false;
    }
  }

  return true;
}

function showFieldError(input, message) {
  const container = input.closest('div') || input.parentElement;
  const existingError = container.querySelector(
    '.field-error[data-for="' + input.name + '"]'
  );

  if (existingError) {
    existingError.textContent = message;
    return;
  }

  const errorElement = document.createElement('p');
  errorElement.className = 'field-error mt-1 text-sm text-red-600';
  errorElement.setAttribute('data-for', input.name);
  errorElement.textContent = message;

  input.parentNode.insertBefore(errorElement, input.nextSibling);
}

function clearFieldError(input) {
  const container = input.closest('div') || input.parentElement;
  const errorElement = container.querySelector(
    '.field-error[data-for="' + input.name + '"]'
  );
  if (errorElement) {
    errorElement.remove();
  }
}

function getFieldLabel(input) {
  const label =
    input.labels?.[0] ||
    input.parentElement.querySelector('label') ||
    input.previousElementSibling;

  if (label) {
    return label.textContent.trim().replace(/[*:]/g, '');
  }

  return input.name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone) {
  const phoneRegex = /^\d{10,15}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

function showErrors(form, errors) {
  Object.keys(errors).forEach(fieldName => {
    const messages = Array.isArray(errors[fieldName])
      ? errors[fieldName]
      : [String(errors[fieldName])];
    const input = form.querySelector(`[name="${CSS.escape(fieldName)}"]`);
    if (!input) return;

    showFieldError(input, messages[0]);
  });
}

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach(el => {
    el.remove();
  });
}
