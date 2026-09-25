"use client";

import { motion } from "motion/react";
import Link from "next/link";

interface Persona {
  key: string;
  name: string;
  title: string;
  href: string;
  cta: string;
  icon: string;
}

export function HeroClient({ personas, stats }: { personas: Persona[], stats: { postings: string, employers: number, districts: string } }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 sm:p-12 font-sans selection:bg-blue-200">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-5xl w-full"
      >
        <div className="text-center mb-16 space-y-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block bg-white border border-neutral-200 shadow-sm rounded-full px-4 py-1.5 text-sm font-medium text-neutral-600 mb-4"
          >
            SIH 2026 • Kaushal Setu
          </motion.div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-neutral-900 leading-tight">
            Bridging the gap between <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              skills and industry.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-neutral-500 max-w-2xl mx-auto font-light leading-relaxed">
            Real-time labor market intelligence across {stats.districts} districts. Powered by AI and real employer data to align ITI curricula with what the market actually needs.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mt-8 pt-4">
            <div className="flex flex-col items-center px-6 py-4 bg-white rounded-2xl border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <span className="text-3xl font-bold text-neutral-900">{stats.postings}</span>
              <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mt-1">Live Postings</span>
            </div>
            <div className="flex flex-col items-center px-6 py-4 bg-white rounded-2xl border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <span className="text-3xl font-bold text-neutral-900">{stats.employers}+</span>
              <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mt-1">Employers Surveyed</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          {personas.map((p, i) => (
            <Link href={p.href} key={p.key} className="group outline-none">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (i * 0.1), duration: 0.5 }}
                className="h-full relative overflow-hidden bg-white rounded-3xl p-8 border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1"
              >
                <div className="text-4xl mb-6 bg-neutral-50 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">{p.icon}</div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">{p.title}</h3>
                <p className="text-neutral-500 text-sm leading-relaxed mb-8">{p.name}</p>
                <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between text-blue-600 font-medium text-sm">
                  <span>{p.cta}</span>
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
