'use strict';

// Dropdown menus: <button data-toggle="dropdown" data-target="id">
document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle="dropdown"]');

    if (toggle) {
        const target = document.getElementById(toggle.dataset.target);
        if (target) target.classList.toggle('show');
        return;
    }

    if (!event.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-content.show').forEach((el) => el.classList.remove('show'));
    }
});

// Confirmation dialogs: <form data-confirm="message">
document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-confirm]');
    if (form && !window.confirm(form.dataset.confirm)) {
        event.preventDefault();
    }
});
