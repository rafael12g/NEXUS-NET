'use strict';

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const CONTAINER_ID_RE = /^[a-f0-9]{12,64}$/i;

function validateUsername(username) {
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
        return "Le nom d'utilisateur doit faire 3 à 30 caractères (lettres, chiffres, . _ -).";
    }
    return null;
}

function validateEmail(email) {
    if (email === undefined || email === null || email === '') return null; // optional
    if (typeof email !== 'string' || email.length > 255 || !EMAIL_RE.test(email)) {
        return 'Adresse email invalide.';
    }
    return null;
}

function validatePassword(password) {
    if (typeof password !== 'string' || password.length < 8) {
        return 'Le mot de passe doit contenir au moins 8 caractères.';
    }
    if (password.length > 200) {
        return 'Le mot de passe est trop long.';
    }
    return null;
}

function sanitizeThemeColor(color, fallback = '#38bdf8') {
    return HEX_COLOR_RE.test(color || '') ? color : fallback;
}

function isValidContainerId(id) {
    return typeof id === 'string' && CONTAINER_ID_RE.test(id);
}

function validatePlanName(name) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
        return 'Le nom du plan doit faire entre 1 et 100 caractères.';
    }
    return null;
}

module.exports = {
    validateUsername,
    validateEmail,
    validatePassword,
    sanitizeThemeColor,
    isValidContainerId,
    validatePlanName
};
