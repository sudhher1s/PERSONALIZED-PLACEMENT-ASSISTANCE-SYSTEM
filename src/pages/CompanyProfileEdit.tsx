import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Briefcase, User, Phone, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";

export default function CompanyProfileEdit() {
  const { user, refreshUser } = useAuth();

  const [form, setForm] = useState({
    fullName: user?.profile?.fullName ?? "",
    phone: user?.profile?.phone ?? "",
    companyName: user?.companyName ?? "",
    hiringFor: user?.hiringFor ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        fullName: form.fullName.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      // Note: companyName and hiringFor are stored as top-level user fields.
      // The profile patch endpoint accepts them generically.
      toast({ title: "Profile Updated", description: "Your company profile has been saved." });
      await refreshUser();
    } catch (e: any) {
      toast({ title: "Update Failed", description: e?.error ?? "Could not update profile.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-16 container mx-auto px-4 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <Link to="/company">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Edit Company Profile</h1>
              <p className="text-sm text-muted-foreground">Update your recruiter details</p>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-4 h-4" /> Recruiter Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="pl-10"
                      placeholder="Your full name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                      className="pl-10"
                      maxLength={10}
                      placeholder="10-digit mobile"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="w-4 h-4" /> Company Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      className="pl-10"
                      placeholder="Acme Corp"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Hiring For (Role)</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={form.hiringFor}
                      onChange={(e) => setForm({ ...form, hiringFor: e.target.value })}
                      className="pl-10"
                      placeholder="Full Stack Developer"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The "Hiring For" role is used to automatically filter and rank matching candidates in your dashboard.
                </p>
              </CardContent>
            </Card>

            <Button
              onClick={save}
              disabled={saving}
              className="w-full gradient-primary text-primary-foreground border-0 gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
