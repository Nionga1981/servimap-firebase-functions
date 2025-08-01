// ==================== NAVEGACIÓN MÓVIL ====================
const navMenu = document.getElementById('nav-menu');
const navToggle = document.getElementById('nav-toggle');
const navClose = document.getElementById('nav-close');
const navLinks = document.querySelectorAll('.nav__link');

// Mostrar menú móvil
if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.add('show');
    });
}

// Ocultar menú móvil
if (navClose) {
    navClose.addEventListener('click', () => {
        navMenu.classList.remove('show');
    });
}

// Cerrar menú al hacer clic en un enlace
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('show');
    });
});

// ==================== SCROLL HEADER ====================
const header = document.getElementById('header');

function scrollHeader() {
    if (window.scrollY >= 50) {
        header.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
    } else {
        header.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
    }
}

window.addEventListener('scroll', scrollHeader);

// ==================== SCROLL ACTIVO ====================
const sections = document.querySelectorAll('section[id]');

function scrollActive() {
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
        const sectionHeight = current.offsetHeight;
        const sectionTop = current.offsetTop - 100;
        const sectionId = current.getAttribute('id');
        const navLink = document.querySelector('.nav__menu a[href*=' + sectionId + ']');

        if (navLink) {
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLink.classList.add('active');
            } else {
                navLink.classList.remove('active');
            }
        }
    });
}

window.addEventListener('scroll', scrollActive);

// ==================== ANIMACIÓN AL SCROLL ====================
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observerCallback = (entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
};

const observer = new IntersectionObserver(observerCallback, observerOptions);

// Aplicar animación a elementos
const animatedElements = document.querySelectorAll('.section > .container > *');
animatedElements.forEach(element => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(element);
});

// ==================== CARGA DE LOGOS DINÁMICAMENTE ====================
function loadCompanyLogos() {
    const logosGrid = document.getElementById('logos-grid');
    
    // Simulación de logos de empresas (en producción, estos vendrían de Firestore)
    const companies = [
        { name: 'Empresa 1', logo: '/logos/empresa1.png' },
        { name: 'Empresa 2', logo: '/logos/empresa2.png' },
        { name: 'Empresa 3', logo: '/logos/empresa3.png' },
        { name: 'Empresa 4', logo: '/logos/empresa4.png' },
        { name: 'Empresa 5', logo: '/logos/empresa5.png' },
        { name: 'Empresa 6', logo: '/logos/empresa6.png' }
    ];
    
    // Si quisieras cargar desde Firestore, descomenta este código:
    /*
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        const db = firebase.firestore();
        db.collection('companies').limit(6).get()
            .then(snapshot => {
                logosGrid.innerHTML = '';
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const logoItem = document.createElement('div');
                    logoItem.className = 'logo__item';
                    logoItem.innerHTML = `<img src="${data.logo}" alt="${data.name}">`;
                    logosGrid.appendChild(logoItem);
                });
            })
            .catch(error => {
                console.error('Error loading logos:', error);
            });
    }
    */
}

// Cargar logos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', loadCompanyLogos);

// ==================== SMOOTH SCROLL PARA ENLACES INTERNOS ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const headerOffset = 100;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ==================== LAZY LOADING DE IMÁGENES ====================
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src || img.src;
            img.classList.add('loaded');
            observer.unobserve(img);
        }
    });
});

document.querySelectorAll('img').forEach(img => {
    if (img.dataset.src) {
        imageObserver.observe(img);
    }
});

// ==================== FORMULARIO DE CONTACTO (PREPARADO PARA FUTURO) ====================
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Aquí iría la lógica para enviar el formulario
            // Por ejemplo, usando Firebase Functions
            
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData);
            
            console.log('Formulario enviado:', data);
            
            // Mostrar mensaje de éxito
            alert('¡Gracias por contactarnos! Te responderemos pronto.');
            contactForm.reset();
        });
    }
}

// ==================== ANIMACIÓN DE NÚMEROS (PARA ESTADÍSTICAS) ====================
function animateNumbers() {
    const numbers = document.querySelectorAll('.stat-number');
    
    numbers.forEach(number => {
        const target = parseInt(number.dataset.target);
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;
        
        const updateNumber = () => {
            current += increment;
            if (current < target) {
                number.textContent = Math.floor(current);
                requestAnimationFrame(updateNumber);
            } else {
                number.textContent = target;
            }
        };
        
        // Iniciar animación cuando el elemento sea visible
        const numberObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateNumber();
                    numberObserver.unobserve(entry.target);
                }
            });
        });
        
        numberObserver.observe(number);
    });
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    initContactForm();
    animateNumbers();
    
    // Log para verificar que el script se cargó correctamente
    console.log('ServiMap Landing Page - Scripts cargados correctamente');
});