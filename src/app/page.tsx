import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Search, Briefcase, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-bold text-primary mb-4">Welcome to ServiMap</h1>
        <p className="text-xl text-foreground/80 max-w-2xl mx-auto">
          Your one-stop platform to connect with skilled professionals or offer your expert services. Fast, reliable, and secure.
        </p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <div className="flex items-center gap-4 mb-2">
              <Search className="w-10 h-10 text-accent" />
              <CardTitle className="text-2xl">Find Services</CardTitle>
            </div>
            <CardDescription>
              Need help? Browse through a wide range of services offered by verified professionals near you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client" legacyBehavior>
              <Button className="w-full" variant="default">
                Explore Services <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <div className="flex items-center gap-4 mb-2">
              <Briefcase className="w-10 h-10 text-accent" />
              <CardTitle className="text-2xl">Offer Services</CardTitle>
            </div>
            <CardDescription>
              Are you a skilled professional? List your services, set your availability, and connect with clients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/provider" legacyBehavior>
              <Button className="w-full" variant="default">
                Become a Provider <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 lg:col-span-1 md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-4 mb-2">
              <MessageSquare className="w-10 h-10 text-accent" />
              <CardTitle className="text-2xl">Chat & AI Guard Demo</CardTitle>
            </div>
            <CardDescription>
              Experience our secure chat interface and see our AI-powered message moderation in action.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/chat" legacyBehavior>
              <Button className="w-full" variant="outline">
                Try Chat Demo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
