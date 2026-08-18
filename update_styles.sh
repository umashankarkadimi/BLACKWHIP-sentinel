sed -i "s/bg-red-900\/30 text-red-400 border border-red-500\/30/bg-red-100 text-red-700 border border-red-200/g" frontend/src/components/Dashboard.tsx
sed -i "s/bg-orange-900\/30 text-orange-400 border border-orange-500\/30/bg-orange-100 text-orange-700 border border-orange-200/g" frontend/src/components/Dashboard.tsx
sed -i "s/bg-amber-900\/30 text-amber-400 border border-amber-500\/30/bg-amber-100 text-amber-700 border border-amber-200/g" frontend/src/components/Dashboard.tsx
sed -i "s/bg-blue-900\/30 text-blue-400 border border-blue-500\/30/bg-blue-100 text-blue-700 border border-blue-200/g" frontend/src/components/Dashboard.tsx
sed -i "s/bg-zinc-800 text-zinc-400 border border-zinc-700/bg-stone-100 text-stone-600 border border-stone-200/g" frontend/src/components/Dashboard.tsx

sed -i "s/bg-blue-900\/20 text-blue-400 border-blue-500\/30/bg-blue-50 text-blue-700 border-blue-200/g" frontend/src/components/Dashboard.tsx
sed -i "s/bg-amber-900\/20 text-amber-400 border-amber-500\/30/bg-amber-50 text-amber-700 border-amber-200/g" frontend/src/components/Dashboard.tsx
sed -i "s/bg-emerald-900\/20 text-emerald-600 border-emerald-500\/30/bg-emerald-50 text-emerald-700 border-emerald-200/g" frontend/src/components/Dashboard.tsx
sed -i "s/bg-zinc-800\/40 text-zinc-400 border-zinc-700/bg-stone-50 text-stone-600 border-stone-200/g" frontend/src/components/Dashboard.tsx

# Also text shadows glow opacity can be lowered
sed -i "s/rgba(239, 68, 68, 0.6)/rgba(239, 68, 68, 0.2)/g" frontend/src/components/Dashboard.tsx
sed -i "s/rgba(249, 115, 22, 0.6)/rgba(249, 115, 22, 0.2)/g" frontend/src/components/Dashboard.tsx
sed -i "s/rgba(234, 179, 8, 0.6)/rgba(234, 179, 8, 0.2)/g" frontend/src/components/Dashboard.tsx
sed -i "s/rgba(59, 130, 246, 0.6)/rgba(59, 130, 246, 0.2)/g" frontend/src/components/Dashboard.tsx
sed -i "s/rgba(16, 185, 129, 0.6)/rgba(16, 185, 129, 0.2)/g" frontend/src/components/Dashboard.tsx

# Update same for IncidentView which uses these imported from Dashboard? Actually Dashboard exports them so they are used in IncidentView.

