/* =====================================================
   Public Contact Form — Supabase submission
   Also supports Formspree as a fallback.
   ===================================================== */

(function () {
  const form = document.querySelector('.contact-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Sending…';
    btn.disabled = true;

    const payload = {
      name:         form.querySelector('#name')?.value.trim()     || null,
      company:      form.querySelector('#company')?.value.trim()  || null,
      email:        form.querySelector('#email')?.value.trim()    || null,
      phone:        form.querySelector('#phone')?.value.trim()    || null,
      project_name: form.querySelector('#project')?.value.trim()  || null,
      tests_needed: form.querySelector('#tests')?.value.trim()    || null,
      timeline:     form.querySelector('#timeline')?.value.trim() || null,
    };

    try {
      // Try Supabase first (works without Formspree account)
      if (typeof db !== 'undefined') {
        const { error } = await db.from('quote_requests').insert(payload);
        if (error) throw new Error(error.message);
      } else {
        // Fallback: submit to Formspree action URL
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Form submission failed.');
      }

      // Success
      form.innerHTML = `
        <div style="text-align:center;padding:3rem 1rem">
          <div style="font-size:2.5rem;margin-bottom:.75rem">✓</div>
          <h3 style="margin-bottom:.5rem">Request Received!</h3>
          <p style="color:var(--clr-text-muted)">
            Thank you, <strong>${escText(payload.name)}</strong>. We'll be in touch within one business day.
          </p>
        </div>`;
    } catch (err) {
      btn.textContent = originalText;
      btn.disabled = false;
      alert('Something went wrong: ' + err.message + '\n\nPlease email us directly.');
    }
  });

  function escText(str) {
    return String(str || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
})();
