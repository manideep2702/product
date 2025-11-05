"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Contact2Props {
  title?: string;
  description?: string;
  // Single phone/email kept for backward compatibility
  phone?: string;
  email?: string;
  // Preferred: multiple phones/emails
  phones?: string[];
  emails?: string[];
  // Optional address block (supports multiple lines)
  address?: string | React.ReactNode;
  web?: { label: string; url: string };
}

export const Contact2 = ({
  title = "Contact Us",
  description = "We are available for questions, feedback, or collaboration opportunities. Let us know how we can help!",
  phone = "+91 99999 99999",
  email = "info@ayyappatemple.org",
  phones,
  emails,
  address,
  web = { label: "Sree Sabari Sastha Seva Samithi (SSSSS)", url: "/" },
}: Contact2Props) => {
  const phoneList = phones && phones.length > 0 ? phones : phone ? [phone] : [];
  const emailList = emails && emails.length > 0 ? emails : email ? [email] : [];

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [emailAddr, setEmailAddr] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [phoneNo, setPhoneNo] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState<null | { ok: boolean; error?: string }>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !emailAddr || !message) {
      alert("Please fill First Name, Email and Message.");
      return;
    }
    setLoading(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      let user_id: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        user_id = data?.user?.id ?? null;
      } catch {}
      const { error } = await supabase.from("contact-us").insert({
        user_id,
        first_name: firstName,
        last_name: lastName || null,
        email: emailAddr,
        phone: phoneNo || null,
        subject: subject || null,
        message,
      });
      if (error) throw new Error(error.message);
      setSent({ ok: true });
      setFirstName("");
      setLastName("");
      setEmailAddr("");
      setSubject("");
      setMessage("");
      setPhoneNo("");
    } catch (e: any) {
      setSent({ ok: false, error: e?.message || "Failed to send" });
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="pt-28 pb-24">
      <div className="container">
        <div className="mx-auto flex max-w-screen-xl flex-col justify-between gap-10 lg:flex-row lg:gap-20">
          <div className="mx-auto flex max-w-sm flex-col justify-between gap-10">
            <div className="text-left">
              <h1 className="mb-2 text-5xl font-semibold lg:mb-1 lg:text-6xl">
                {title}
              </h1>
              <p className="text-muted-foreground">{description}</p>
            </div>
            <div className="w-fit lg:mx-0">
              <h3 className="mb-6 text-left text-2xl font-semibold">
                Contact Details
              </h3>
              <ul className="ml-4 list-disc">
                {address && (
                  <li>
                    <span className="font-bold">Address: </span>
                    <span className="whitespace-pre-line">{address}</span>
                  </li>
                )}
                {phoneList.length > 0 && (
                  <li>
                    <span className="font-bold">Phone: </span>
                    <span className="inline-block align-middle">{phoneList.join(", ")}</span>
                  </li>
                )}
                {emailList.length > 0 && (
                  <li>
                    <span className="font-bold">Email: </span>
                    <span className="inline-block align-middle">
                      {emailList.map((em, i) => (
                        <React.Fragment key={`${em}-${i}`}>
                          <a href={`mailto:${em}`} className="underline">
                            {em}
                          </a>
                          {i < emailList.length - 1 ? ", " : null}
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                )}
                <li>
                  <span className="font-bold">Web: </span>
                  <a href={web.url} target="_blank" className="underline">
                    {web.label}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <form onSubmit={onSubmit} className="mx-auto flex max-w-screen-md flex-col gap-6 rounded-lg border p-10">
            <div className="flex gap-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="firstname">First Name</Label>
                <Input type="text" id="firstname" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="lastname">Last Name</Label>
                <Input type="text" id="lastname" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input type="email" id="email" placeholder="Email" value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)} required />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input type="tel" id="phone" placeholder="Phone" value={phoneNo} onChange={(e) => setPhoneNo(e.target.value)} />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input type="text" id="subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="grid w-full gap-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea placeholder="Type your message here." id="message" value={message} onChange={(e) => setMessage(e.target.value)} required />
            </div>
            <Button className="w-full" disabled={loading}>{loading ? "Sending…" : "Send Message"}</Button>
            {sent?.ok && <p className="text-green-500 text-sm">Thanks! Your message has been sent.</p>}
            {sent && !sent.ok && <p className="text-red-500 text-sm">{sent.error}</p>}
          </form>
        </div>
      </div>
    </section>
  );
};
