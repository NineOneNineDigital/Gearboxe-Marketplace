"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/ui/navbar";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Clock, Mail, Phone } from "lucide-react";
import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "How do I list my vehicle for sale?",
    answer:
      "To list your vehicle, sign up for an account and navigate to your dashboard. Click 'New Listing' and fill out the vehicle information form. Once submitted, our team will review and approve your listing within 24-48 hours.",
  },
  {
    question: "What are the fees for selling a vehicle?",
    answer:
      "We charge a flat fee of $50 per vehicle listing. This includes listing your vehicle on our platform, featuring it at our monthly events, and providing marketing support. Payment is due when your listing is approved.",
  },
  {
    question: "How do I attend a car market event?",
    answer:
      "Browse our upcoming events page and click 'Register' on any event you'd like to attend. Registration is free for buyers. If you're selling, you'll need to have an approved vehicle listing first.",
  },
  {
    question: "What types of vehicles can I sell?",
    answer:
      "We accept all types of vehicles including cars, trucks, motorcycles, and specialty vehicles. All vehicles must be legally owned by the seller and have a clean title. We do not accept vehicles with salvage titles or significant damage.",
  },
  {
    question: "How long does it take to approve a listing?",
    answer:
      "Our team typically reviews and approves vehicle listings within 24-48 hours during business days. You'll receive an email notification once your listing is approved or if we need additional information.",
  },
  {
    question: "Can I edit my vehicle listing after it's approved?",
    answer:
      "Yes, you can edit your listing at any time through your dashboard. Changes to price, description, or photos will be reviewed and updated within 24 hours.",
  },
  {
    question: "What happens if my vehicle doesn't sell?",
    answer:
      "Your listing will remain active on our platform for 90 days. After that, you can renew your listing for another 90 days for a reduced fee of $25. You can also attend multiple events to showcase your vehicle.",
  },
  {
    question: "How do I contact a seller?",
    answer:
      "Use our built-in messaging system to contact sellers directly. Click the 'Message' button on any vehicle listing to start a conversation. All communications are monitored for safety and quality.",
  },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    setSubmitted(true);

    // Reset form after 3 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    }, 3000);
  };

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      {/* Main Content */}
      <div className="flex-1">
        {/* Hero Section */}
        <section className="py-16 bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Contact Us
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Have questions about our car market events or need help with
                your listing? We're here to help you every step of the way.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Email Us
                </h3>
                <p className="text-gray-600">support@gearboxemarket.com</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Call Us
                </h3>
                <p className="text-gray-600">(555) 123-4567</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Business Hours
                </h3>
                <p className="text-gray-600">Mon-Fri: 9AM-6PM</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form and FAQ */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Contact Form */}
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Send us a message
                </h2>
                <Card className="p-8 bg-white border-gray-200">
                  {submitted ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail className="h-8 w-8 text-green-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Message Sent!
                      </h3>
                      <p className="text-gray-600">
                        Thank you for contacting us. We'll get back to you
                        within 24 hours.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="name"
                            className="text-sm font-medium text-gray-700"
                          >
                            Full Name *
                          </Label>
                          <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500"
                            placeholder="Enter your full name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="email"
                            className="text-sm font-medium text-gray-700"
                          >
                            Email Address *
                          </Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500"
                            placeholder="Enter your email"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="phone"
                            className="text-sm font-medium text-gray-700"
                          >
                            Phone Number
                          </Label>
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className="border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500"
                            placeholder="Enter your phone number"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="subject"
                            className="text-sm font-medium text-gray-700"
                          >
                            Subject *
                          </Label>
                          <Input
                            id="subject"
                            name="subject"
                            value={formData.subject}
                            onChange={handleInputChange}
                            className="border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500"
                            placeholder="What's this about?"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="message"
                          className="text-sm font-medium text-gray-700"
                        >
                          Message *
                        </Label>
                        <Textarea
                          id="message"
                          name="message"
                          value={formData.message}
                          onChange={handleInputChange}
                          className="border-gray-300 focus:border-primary focus:ring-primary bg-white text-gray-900 placeholder:text-gray-500 min-h-[120px]"
                          placeholder="Tell us how we can help you..."
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/90 text-white py-3 text-base font-medium"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Sending..." : "Send Message"}
                      </Button>
                    </form>
                  )}
                </Card>
              </div>

              {/* FAQ Section */}
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Frequently Asked Questions
                </h2>
                <div className="space-y-4">
                  {faqData.map((faq, index) => (
                    <Card key={index} className="bg-white border-gray-200">
                      <button
                        onClick={() => toggleFAQ(index)}
                        className="w-full p-6 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 pr-4">
                          {faq.question}
                        </h3>
                        {expandedFAQ === index ? (
                          <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        )}
                      </button>
                      {expandedFAQ === index && (
                        <div className="px-6 pb-6">
                          <p className="text-gray-600 leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
