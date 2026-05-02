import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Menu, X, CheckCircle, HardHat,
  Home, ArrowRight, Wrench, Target, Leaf, BarChart
} from 'lucide-react';
import { createContactInquiry } from '../../lib/firestore';

// Data
const SERVICES = [
  { icon: HardHat, title: 'Infrastructure Development', desc: 'Roads, utilities & civil engineering projects across Kerala, built to last decades.', img: '/images/service-infrastructure.png' },
  { icon: Building2, title: 'Commercial Buildings', desc: 'Offices, retail & mixed-use complexes delivered on schedule and within budget.', img: '/images/service-commercial.png' },
  { icon: Home, title: 'Urban Solutions', desc: 'Custom homes & residential planning crafted to lifestyle with premium finishes and timeless architecture.', img: '/images/service-residential.png' },
];

const EXPERTISE = [
  { icon: Wrench, title: 'Advanced Engineering', desc: 'Employing cutting-edge construction techniques for maximum durability and precision.' },
  { icon: Target, title: 'Strategic Planning', desc: 'Meticulous project management ensuring timely delivery and exact cost control.' },
  { icon: Leaf, title: 'Sustainable Solutions', desc: 'Eco-friendly building practices and advanced materials for a greener future.' },
  { icon: BarChart, title: 'Transparent Tracking', desc: 'Real-time project updates and seamless communication via our exclusive TMS portal.' },
];

const PROJECTS = [
  { name: 'Skyline Tower', desc: 'Premium residential apartments with state-of-the-art amenities and breathtaking views.', img: '/images/project-apartment.png' },
  { name: 'Corporate Headquarters', desc: 'Modern commercial workspace designed for optimal productivity and business growth.', img: '/images/project-commercial.png' },
  { name: 'International Business Center', desc: 'Luxury independent architecture offering unmatched comfort, elegance, and connectivity.', img: '/images/project-villa.png' },
];

// WhatsApp button component
function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/919876543210?text=Hello%2C%20I%27m%20interested%20in%20your%20construction%20services."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#25D366] text-white font-semibold text-sm px-4 py-3 rounded shadow-xl hover:shadow-green-500/30 hover:-translate-y-1 transition-all duration-300 group"
    >
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      <span className="hidden sm:inline">Chat on WhatsApp</span>
      <span className="sm:hidden">WhatsApp</span>
    </a>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  const [contactForm, setContactForm] = useState({
    name: '', phone: '', email: '', projectType: 'Residential', message: '',
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setContactForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.phone.trim() || !contactForm.message.trim()) return;
    setContactSubmitting(true);
    try {
      await createContactInquiry({
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim(),
        email: contactForm.email.trim() || undefined,
        projectType: contactForm.projectType,
        message: contactForm.message.trim(),
        status: 'new',
        source: 'website',
      });
      setContactSuccess(true);
      setContactForm({ name: '', phone: '', email: '', projectType: 'Residential', message: '' });
    } catch {
      alert('Something went wrong. Please try again or call us directly.');
    } finally {
      setContactSubmitting(false);
    }
  };

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const NAV = ['Home', 'Services', 'Projects', 'About', 'Contact'];

  return (
    <div className="min-h-screen font-sans bg-[#f4f7f9] text-[#0f2143] overflow-x-hidden selection:bg-[#1b61d4] selection:text-white">
      <WhatsAppButton />

      {/* --- Header --- */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0f2143]/95 backdrop-blur-md shadow-lg py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <div className="w-10 h-10 border-2 border-white flex items-center justify-center rotate-45">
              <div className="w-4 h-4 bg-white -rotate-45" />
            </div>
            <span className="font-bold text-2xl tracking-wide text-white uppercase">Kurickal</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-10">
            {NAV.map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-sm font-medium text-white/90 hover:text-white transition-colors relative group">
                {l}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#1b61d4] transition-all group-hover:w-full"></span>
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-semibold px-6 py-2.5 rounded text-white bg-[#1b61d4] hover:bg-[#154db0] transition-colors shadow-[0_4px_14px_0_rgba(27,97,212,0.39)]"
            >
              TMS Portal
            </button>
          </div>

          <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-[#0f2143] border-t border-white/10 px-5 py-4 shadow-xl">
            {NAV.map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMenuOpen(false)} className="block py-3 text-white font-medium border-b border-white/10">{l}</a>
            ))}
            <button
              onClick={() => { setMenuOpen(false); navigate('/login'); }}
              className="w-full mt-4 bg-[#1b61d4] text-white font-semibold py-3 rounded text-center"
            >
              TMS Portal
            </button>
          </div>
        )}
      </header>

      {/* --- Hero Section --- */}
      <section id="home" className="relative pt-32 pb-56 lg:pt-48 lg:pb-72 bg-[#0f2143] z-0">
        <div className="absolute inset-0 z-0">
          <img src="/images/hero-bg.png" alt="Cityscape" className="w-full h-full object-cover opacity-50 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f2143]/80 via-[#0f2143]/50 to-[#0f2143]"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.15] mb-6 tracking-tight">
              Advancing Innovative <br /> Engineering & Construction
            </h1>
            <p className="text-lg sm:text-xl text-blue-100/90 mb-10 max-w-xl font-light">
              Building the future with expertise and excellence. Delivering premium infrastructure and spaces across Kerala.
            </p>
            <a href="#about" className="inline-block bg-[#1b61d4] hover:bg-[#154db0] text-white text-sm font-semibold px-8 py-3.5 rounded transition-all shadow-lg hover:shadow-xl shadow-[#1b61d4]/20">
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* --- Services Section (Overlapping) --- */}
      <section id="services" className="relative z-20 -mt-36 lg:-mt-48 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {SERVICES.map((s, i) => (
              <div key={i} className="group flex flex-col bg-[#142952] border border-white/5 rounded-sm overflow-hidden shadow-2xl transition-transform hover:-translate-y-2 duration-300">
                <div className="h-48 sm:h-56 overflow-hidden">
                  <img src={s.img} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6 lg:p-8 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-semibold text-white leading-tight w-2/3">{s.title}</h3>
                    <s.icon className="w-8 h-8 text-white/50" strokeWidth={1.5} />
                  </div>
                  <p className="text-xs text-blue-100/60 leading-relaxed mb-8 flex-grow">{s.desc}</p>
                  <a href="#contact" className="inline-block self-start border border-white/20 bg-white/5 text-white text-xs font-medium px-5 py-2.5 rounded hover:bg-white hover:text-[#0f2143] transition-colors">
                    Discover More
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- About Us / Expertise --- */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
            
            {/* Left: About Us */}
            <div>
              <h2 className="text-3xl font-semibold text-[#0f2143] mb-8">About Us</h2>
              <div className="rounded-sm overflow-hidden shadow-lg border border-slate-100">
                <img src="/images/about-team.png" alt="Our Building" className="w-full h-[300px] sm:h-[400px] object-cover" />
              </div>
            </div>

            {/* Right: Our Expertise */}
            <div className="flex flex-col">
              <h2 className="text-3xl font-semibold text-[#0f2143] mb-10">Our Expertise</h2>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-12 mb-12">
                {EXPERTISE.map((exp, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="shrink-0 mt-1">
                      <exp.icon className="w-7 h-7 text-[#1b61d4]" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#0f2143] mb-2">{exp.title}</h4>
                      <p className="text-[13px] text-slate-500 leading-relaxed">{exp.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <a href="#contact" className="inline-block bg-[#1b61d4] hover:bg-[#154db0] text-white text-sm font-semibold px-8 py-3.5 rounded transition-all shadow-md hover:shadow-lg shadow-[#1b61d4]/20">
                  Global Reach
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- Featured Projects --- */}
      <section id="projects" className="py-24 bg-[#0f2143]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <h2 className="text-3xl lg:text-4xl font-semibold text-white">Featured Projects</h2>
            <p className="text-[13px] text-blue-100/60 max-w-md leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {PROJECTS.map((p, i) => (
              <div key={i} className="group bg-[#142952] border border-white/5 rounded-sm overflow-hidden shadow-xl transition-transform hover:-translate-y-2 duration-300 cursor-pointer">
                <div className="h-56 overflow-hidden">
                  <img src={p.img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6 flex items-start justify-between bg-[#11244e]">
                  <div>
                    <h4 className="text-[15px] font-semibold text-white mb-2">{p.name}</h4>
                    <p className="text-xs text-blue-100/50 leading-relaxed">{p.desc}</p>
                  </div>
                  <div className="shrink-0 ml-4 mt-1">
                    <Building2 className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Contact Section --- */}
      <section id="contact" className="py-24 bg-[#f4f7f9] relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-semibold text-[#0f2143] mb-4">Get in Touch</h2>
            <p className="text-slate-500">Contact us to discuss your vision. We provide complimentary site visits and initial consultations.</p>
          </div>

          <div className="bg-white p-8 md:p-12 rounded shadow-sm border border-slate-100">
            {contactSuccess ? (
                <div className="text-center py-10 animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#0f2143] mb-3">Inquiry Received</h3>
                    <p className="text-slate-500 mb-8 max-w-sm mx-auto">Thank you for reaching out. A Kurickal representative will contact you shortly.</p>
                    <button onClick={() => setContactSuccess(false)} className="text-[#1b61d4] font-semibold text-sm hover:underline">Submit another inquiry</button>
                </div>
            ) : (
                <form onSubmit={handleContactSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Name</label>
                            <input required name="name" value={contactForm.name} onChange={handleContactChange} className="w-full bg-[#f4f7f9] border border-transparent rounded px-4 py-3.5 text-sm focus:border-[#1b61d4] focus:ring-1 focus:ring-[#1b61d4] focus:bg-white outline-none transition-all" placeholder="Your Name" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Phone</label>
                            <input required name="phone" type="tel" value={contactForm.phone} onChange={handleContactChange} className="w-full bg-[#f4f7f9] border border-transparent rounded px-4 py-3.5 text-sm focus:border-[#1b61d4] focus:ring-1 focus:ring-[#1b61d4] focus:bg-white outline-none transition-all" placeholder="+91..." />
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Email</label>
                            <input name="email" type="email" value={contactForm.email} onChange={handleContactChange} className="w-full bg-[#f4f7f9] border border-transparent rounded px-4 py-3.5 text-sm focus:border-[#1b61d4] focus:ring-1 focus:ring-[#1b61d4] focus:bg-white outline-none transition-all" placeholder="Optional" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Service</label>
                            <select name="projectType" value={contactForm.projectType} onChange={handleContactChange} className="w-full bg-[#f4f7f9] border border-transparent rounded px-4 py-3.5 text-sm focus:border-[#1b61d4] focus:ring-1 focus:ring-[#1b61d4] focus:bg-white outline-none transition-all appearance-none cursor-pointer">
                                <option>Residential</option>
                                <option>Commercial</option>
                                <option>Infrastructure</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Project Details</label>
                        <textarea required name="message" rows={4} value={contactForm.message} onChange={handleContactChange} className="w-full bg-[#f4f7f9] border border-transparent rounded px-4 py-3.5 text-sm focus:border-[#1b61d4] focus:ring-1 focus:ring-[#1b61d4] focus:bg-white outline-none transition-all resize-none" placeholder="Tell us about your requirements..."></textarea>
                    </div>
                    <button disabled={contactSubmitting} type="submit" className="w-full bg-[#1b61d4] hover:bg-[#154db0] text-white font-semibold py-4 rounded transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2">
                        {contactSubmitting ? 'Sending...' : 'Send Message'}
                    </button>
                </form>
            )}
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="bg-[#0f2143] py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 border-2 border-white flex items-center justify-center rotate-45">
                  <div className="w-3 h-3 bg-white -rotate-45" />
                </div>
                <span className="text-white font-bold tracking-wide text-lg uppercase">Kurickal Developers</span>
            </div>
            <div className="flex items-center gap-6 text-blue-100/60 text-[13px] font-medium">
                <a href="#home" className="hover:text-white transition-colors">Home</a>
                <a href="#services" className="hover:text-white transition-colors">Services</a>
                <a href="#projects" className="hover:text-white transition-colors">Projects</a>
                <a href="#about" className="hover:text-white transition-colors">About</a>
                <a href="#contact" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-blue-100/40 text-[11px]">© {new Date().getFullYear()} Kurickal Developers LLP. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
